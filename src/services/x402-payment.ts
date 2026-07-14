import {
  AddressHashMode,
  AnchorMode,
  PubKeyEncoding,
  createAddress,
  createStacksPrivateKey,
  emptyMessageSignature,
  estimateTransactionFeeWithFallback,
  getNonce,
  getPublicKey,
  isSingleSig,
  makeSTXTokenTransfer,
  makeUnsignedSTXTokenTransfer,
  publicKeyToString,
} from '@stacks/transactions'
import type { SingleSigSpendingCondition } from '@stacks/transactions'
import { StacksMainnet, StacksTestnet, type FetchFn, type StacksNetwork } from '@stacks/network'
import {
  createFacilitatorMemo,
  createFacilitatorNonce,
  encodePaymentPayload,
  privateKeyToAccount,
  type PaymentPayloadV2,
  type PaymentRequiredV2,
  type PaymentRequirementsV2,
} from 'x402-stacks'

import { FeeTooHighError, InternalError, ValidationError } from '../core/errors.js'
import {
  readOptionalWalletConfig,
  type OwsWalletConfig,
  type StacksConfig,
  type StacksNetwork as AppStacksNetwork,
  type WalletConfig,
} from '../core/stacks-config.js'
import type { CommandRunner, FetchLike } from '../types/context.js'
import { parseOwsWalletAddress } from './wallet-service.js'

const STACKS_SIGNATURE_OFFSET_BYTES = 44
const STACKS_SIGNATURE_LENGTH_BYTES = 65

const FAKE_COMPRESSED_PUBLIC_KEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
const FAKE_UNCOMPRESSED_PUBLIC_KEY =
  '0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f817984' +
  '83ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'

export interface X402PaymentSignatureOptions {
  env: NodeJS.ProcessEnv
  commandRunner: CommandRunner
  fetcher?: FetchLike
  fee?: bigint
  nonce?: bigint
  walletName?: string
  sleep?: (ms: number) => Promise<void>
}

const DEFAULT_MAX_FEE_USTX = 5000n
const DEFAULT_FEE_MAX_RETRIES = 3
const DEFAULT_FEE_RETRY_DELAY_MS = 2000

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

interface FeeCapConfig {
  maxFeeUstx: bigint
  maxRetries: number
  retryDelayMs: number
}

function readNonNegativeIntEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = env[name]?.trim()
  if (!raw) {
    return undefined
  }

  if (!/^\d+$/.test(raw)) {
    throw new ValidationError(`${name} must be a non-negative integer (got "${raw}").`)
  }

  return raw
}

function readFeeCapConfig(env: NodeJS.ProcessEnv): FeeCapConfig {
  return {
    maxFeeUstx: BigInt(readNonNegativeIntEnv(env, 'AGENTSATS_MAX_FEE_USTX') ?? DEFAULT_MAX_FEE_USTX),
    maxRetries: Number(readNonNegativeIntEnv(env, 'AGENTSATS_FEE_MAX_RETRIES') ?? DEFAULT_FEE_MAX_RETRIES),
    retryDelayMs: Number(readNonNegativeIntEnv(env, 'AGENTSATS_FEE_RETRY_DELAY_MS') ?? DEFAULT_FEE_RETRY_DELAY_MS),
  }
}

async function estimateCappedFee(
  transaction: Awaited<ReturnType<typeof makeUnsignedSTXTokenTransfer>>,
  network: StacksNetwork,
  feeCapConfig: FeeCapConfig,
  sleep: (ms: number) => Promise<void>,
): Promise<bigint> {
  const attempts = feeCapConfig.maxRetries + 1
  let lastEstimate = 0n

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastEstimate = BigInt(await estimateTransactionFeeWithFallback(transaction, network))
    if (lastEstimate <= feeCapConfig.maxFeeUstx) {
      return lastEstimate
    }

    if (attempt < attempts - 1) {
      await sleep(feeCapConfig.retryDelayMs)
    }
  }

  throw new FeeTooHighError(
    `Estimated Stacks transaction fee ${lastEstimate} uSTX exceeds the configured maximum of ${feeCapConfig.maxFeeUstx} uSTX after ${attempts} attempt(s). Payment was not sent.`,
    {
      estimatedFeeUstx: lastEstimate.toString(),
      maxFeeUstx: feeCapConfig.maxFeeUstx.toString(),
      attempts,
    },
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePaymentRequired(value: unknown): PaymentRequiredV2 | undefined {
  if (!isRecord(value) || value.x402Version !== 2 || !isRecord(value.resource) || !Array.isArray(value.accepts)) {
    return undefined
  }

  return value as unknown as PaymentRequiredV2
}

function walletNetworkToCAIP2(network: AppStacksNetwork) {
  return network === 'mainnet' ? 'stacks:1' : 'stacks:2147483648'
}

function selectStacksPaymentOption(
  paymentRequired: PaymentRequiredV2,
  walletConfig: WalletConfig,
): PaymentRequirementsV2 | undefined {
  const network = walletConfig.provider === 'ows'
    ? walletConfig.chain
    : walletNetworkToCAIP2(walletConfig.network)

  return paymentRequired.accepts.find((accept) => (
    accept.scheme === 'exact' &&
    accept.network === network &&
    accept.asset === 'STX' &&
    typeof accept.amount === 'string' &&
    typeof accept.payTo === 'string'
  ))
}

function readPaymentWalletConfig(options: X402PaymentSignatureOptions): WalletConfig | undefined {
  return readOptionalWalletConfig(options.env, {
    ...(options.walletName === undefined ? {} : { walletName: options.walletName }),
  })
}

function createStacksNetwork(network: AppStacksNetwork, fetcher?: FetchLike): StacksNetwork {
  const config = fetcher === undefined
    ? undefined
    : {
        fetchFn: fetcher as FetchFn,
      }

  return network === 'mainnet'
    ? new StacksMainnet(config)
    : new StacksTestnet(config)
}

function normalizeHex(value: string, label: string) {
  const hex = value.trim().replace(/^0x/i, '')

  if (!/^[0-9a-f]*$/i.test(hex)) {
    throw new InternalError(`${label} must be hex encoded.`)
  }

  return hex.toLowerCase()
}

function serializeTransactionHex(transaction: { serialize: () => Uint8Array }) {
  return Buffer.from(transaction.serialize()).toString('hex')
}

export function parseOwsSignTxSignature(output: string) {
  const trimmed = output.trim()
  let signature = trimmed

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { signature?: unknown }
      if (typeof parsed.signature === 'string') {
        signature = parsed.signature
      }
    } catch {
      throw new InternalError('OWS returned invalid JSON while signing the Stacks transaction.')
    }
  }

  const normalized = normalizeHex(signature, 'OWS transaction signature')
  if (normalized.length !== STACKS_SIGNATURE_LENGTH_BYTES * 2) {
    throw new InternalError('OWS returned an invalid Stacks transaction signature length.', {
      expectedBytes: STACKS_SIGNATURE_LENGTH_BYTES,
      actualBytes: normalized.length / 2,
    })
  }

  return normalized
}

export function injectStacksSignature(unsignedTransactionHex: string, signatureHex: string) {
  const unsignedTransaction = normalizeHex(unsignedTransactionHex, 'Unsigned Stacks transaction')
  const signature = normalizeHex(signatureHex, 'Stacks transaction signature')
  const start = STACKS_SIGNATURE_OFFSET_BYTES * 2
  const end = start + STACKS_SIGNATURE_LENGTH_BYTES * 2

  if (signature.length !== STACKS_SIGNATURE_LENGTH_BYTES * 2) {
    throw new InternalError('Stacks transaction signature must be 65 bytes.')
  }

  if (unsignedTransaction.length < end) {
    throw new InternalError('Unsigned Stacks transaction is too short for standard single-sig signing.')
  }

  return `${unsignedTransaction.slice(0, start)}${signature}${unsignedTransaction.slice(end)}`
}

function setTransactionSigner(
  transaction: Awaited<ReturnType<typeof makeUnsignedSTXTokenTransfer>>,
  senderAddress: string,
  keyEncoding: OwsWalletConfig['keyEncoding'],
) {
  const condition = transaction.auth.spendingCondition
  if (!condition || !isSingleSig(condition)) {
    throw new InternalError('Expected a standard single-sig Stacks transaction.')
  }

  const singleSigCondition = condition as SingleSigSpendingCondition
  singleSigCondition.hashMode = AddressHashMode.SerializeP2PKH
  singleSigCondition.signer = createAddress(senderAddress).hash160
  singleSigCondition.keyEncoding = keyEncoding === 'compressed'
    ? PubKeyEncoding.Compressed
    : PubKeyEncoding.Uncompressed
  singleSigCondition.signature = emptyMessageSignature()
}

async function createUnsignedOwsStxTransfer(
  payment: PaymentRequirementsV2,
  config: OwsWalletConfig,
  senderAddress: string,
  options: X402PaymentSignatureOptions,
) {
  const network = createStacksNetwork(config.network, options.fetcher)
  const publicKey = config.keyEncoding === 'compressed'
    ? FAKE_COMPRESSED_PUBLIC_KEY
    : FAKE_UNCOMPRESSED_PUBLIC_KEY
  const transaction = await makeUnsignedSTXTokenTransfer({
    recipient: payment.payTo,
    amount: BigInt(payment.amount),
    publicKey,
    network,
    memo: createFacilitatorMemo(createFacilitatorNonce()),
    anchorMode: AnchorMode.Any,
    fee: options.fee ?? 0n,
    nonce: options.nonce ?? 0n,
  })

  setTransactionSigner(transaction, senderAddress, config.keyEncoding)

  if (options.fee === undefined) {
    const feeCapConfig = readFeeCapConfig(options.env)
    transaction.setFee(await estimateCappedFee(transaction, network, feeCapConfig, options.sleep ?? defaultSleep))
  }

  if (options.nonce === undefined) {
    transaction.setNonce(await getNonce(senderAddress, network))
  }

  return transaction
}

async function getOwsSenderAddress(config: OwsWalletConfig, options: X402PaymentSignatureOptions) {
  const result = await options.commandRunner(config.cliPath, ['wallet', 'list'], { env: options.env })
  return parseOwsWalletAddress(result.stdout, config.wallet, config.chain)
}

async function signOwsPayment(
  payment: PaymentRequirementsV2,
  config: OwsWalletConfig,
  options: X402PaymentSignatureOptions,
) {
  const senderAddress = await getOwsSenderAddress(config, options)
  const transaction = await createUnsignedOwsStxTransfer(payment, config, senderAddress, options)
  const unsignedTransaction = serializeTransactionHex(transaction)
  const result = await options.commandRunner(
    config.cliPath,
    [
      'sign',
      'tx',
      '--chain',
      config.chain,
      '--wallet',
      config.wallet,
      '--tx',
      unsignedTransaction,
      '--json',
    ],
    { env: options.env },
  )
  const signature = parseOwsSignTxSignature(result.stdout)

  return injectStacksSignature(unsignedTransaction, signature)
}

async function estimatePrivateKeyCappedFee(
  payment: PaymentRequirementsV2,
  config: StacksConfig,
  network: StacksNetwork,
  options: X402PaymentSignatureOptions,
) {
  const publicKey = publicKeyToString(getPublicKey(createStacksPrivateKey(config.privateKey)))
  const unsignedTransaction = await makeUnsignedSTXTokenTransfer({
    recipient: payment.payTo,
    amount: BigInt(payment.amount),
    publicKey,
    network,
    memo: createFacilitatorMemo(createFacilitatorNonce()),
    anchorMode: AnchorMode.Any,
    fee: 0n,
    nonce: 0n,
  })

  return estimateCappedFee(unsignedTransaction, network, readFeeCapConfig(options.env), options.sleep ?? defaultSleep)
}

async function signPrivateKeyPayment(
  payment: PaymentRequirementsV2,
  config: StacksConfig,
  options: X402PaymentSignatureOptions,
) {
  const network = createStacksNetwork(config.network, options.fetcher)
  const fee = options.fee ?? await estimatePrivateKeyCappedFee(payment, config, network, options)
  const transaction = await makeSTXTokenTransfer({
    recipient: payment.payTo,
    amount: BigInt(payment.amount),
    senderKey: config.privateKey,
    network,
    memo: createFacilitatorMemo(createFacilitatorNonce()),
    anchorMode: AnchorMode.Any,
    fee,
    ...(options.nonce === undefined ? {} : { nonce: options.nonce }),
  })

  return serializeTransactionHex(transaction)
}

async function signPayment(
  payment: PaymentRequirementsV2,
  walletConfig: WalletConfig,
  options: X402PaymentSignatureOptions,
) {
  if (walletConfig.provider === 'ows') {
    return signOwsPayment(payment, walletConfig, options)
  }

  return signPrivateKeyPayment(payment, walletConfig, options)
}

export async function createX402PaymentSignatureHeader(
  paymentRequiredValue: unknown,
  options: X402PaymentSignatureOptions,
) {
  const paymentRequired = parsePaymentRequired(paymentRequiredValue)
  if (!paymentRequired) {
    return undefined
  }

  const walletConfig = readPaymentWalletConfig(options)
  if (!walletConfig) {
    return undefined
  }

  const payment = selectStacksPaymentOption(paymentRequired, walletConfig)
  if (!payment) {
    return undefined
  }

  if (walletConfig.provider === 'private-key') {
    const account = privateKeyToAccount(walletConfig.privateKey, walletConfig.network)
    const expectedNetwork = walletNetworkToCAIP2(walletConfig.network)
    if (payment.network !== expectedNetwork) {
      throw new ValidationError(`Payment network ${payment.network} does not match wallet network ${expectedNetwork}.`)
    }

    if (!account.address.startsWith(walletConfig.network === 'mainnet' ? 'SP' : 'ST')) {
      throw new ValidationError('Configured private key does not resolve to the selected Stacks network.')
    }
  }

  const signedTransaction = await signPayment(payment, walletConfig, options)
  const payload: PaymentPayloadV2 = {
    x402Version: 2,
    accepted: payment,
    payload: {
      transaction: signedTransaction,
    },
  }

  return encodePaymentPayload(payload)
}
