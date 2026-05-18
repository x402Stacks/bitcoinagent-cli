import { Command } from 'commander'
import { z } from 'zod'

import { normalizeError, ValidationError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import { renderFriendlyError, renderWalletResult, renderWalletSetupResult } from '../output/human.js'
import { setupOwsPreviewWallet } from '../services/ows-preview-setup.js'
import { getWalletInfo } from '../services/wallet-service.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const walletCommandSchema = z.object({
  json: z.boolean().optional(),
  plain: z.boolean().optional(),
})

const walletSetupCommandSchema = z.object({
  json: z.boolean().optional(),
  plain: z.boolean().optional(),
  provider: z.string().optional(),
  previewStacks: z.boolean().optional(),
  wallet: z.string().optional(),
  network: z.string().optional(),
  keyEncoding: z.string().optional(),
})

function getRawFlags(options: Record<string, unknown>) {
  return {
    json: options.json === true,
    plain: options.plain === true,
  }
}

function readSetupNetwork(value: string | undefined) {
  const network = value ?? 'mainnet'

  if (network !== 'mainnet' && network !== 'testnet') {
    throw new ValidationError(`--network must be "mainnet" or "testnet" (got "${network}").`)
  }

  return network
}

function readSetupKeyEncoding(value: string | undefined) {
  const keyEncoding = value ?? 'uncompressed'

  if (keyEncoding !== 'compressed' && keyEncoding !== 'uncompressed') {
    throw new ValidationError(
      `--key-encoding must be "compressed" or "uncompressed" (got "${keyEncoding}").`,
    )
  }

  return keyEncoding
}

function defaultWalletName(network: 'mainnet' | 'testnet') {
  return network === 'mainnet' ? 'agentsats-mainnet' : 'agentsats-testnet'
}

async function handleWallet(
  options: Record<string, unknown>,
  runtime: ResolvedRuntime,
): Promise<number> {
  const context = createCommandContext(getRawFlags(options), runtime)

  try {
    walletCommandSchema.parse(options)
    const timestamp = context.now()
    const result = await getWalletInfo(context.env, timestamp, runtime.commandRunner)

    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }

    await renderWalletResult(context, result)
    return 0
  } catch (error) {
    const normalized = normalizeError(error)

    if (context.mode === 'json') {
      renderJsonError(context, normalized, context.now())
    } else {
      renderFriendlyError(context, normalized)
    }

    return getExitCode(normalized)
  }
}

async function handleWalletSetup(
  options: Record<string, unknown>,
  runtime: ResolvedRuntime,
): Promise<number> {
  const context = createCommandContext(getRawFlags(options), runtime)

  try {
    const parsed = walletSetupCommandSchema.parse(options)

    if (parsed.provider !== 'ows') {
      throw new ValidationError('--provider must be "ows" for wallet setup.')
    }

    if (parsed.previewStacks !== true) {
      throw new ValidationError('OWS Stacks setup requires --preview-stacks.')
    }

    const network = readSetupNetwork(parsed.network)
    const keyEncoding = readSetupKeyEncoding(parsed.keyEncoding)
    const wallet = parsed.wallet?.trim() || defaultWalletName(network)
    const timestamp = context.now()
    const result = await setupOwsPreviewWallet({
      env: context.env,
      commandRunner: runtime.commandRunner,
      wallet,
      network,
      keyEncoding,
      timestamp,
    })

    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }

    await renderWalletSetupResult(context, result)
    return 0
  } catch (error) {
    const normalized = normalizeError(error)

    if (context.mode === 'json') {
      renderJsonError(context, normalized, context.now())
    } else {
      renderFriendlyError(context, normalized)
    }

    return getExitCode(normalized)
  }
}

export function registerWalletCommand(program: Command, runtime: ResolvedRuntime) {
  const walletCommand = program
    .command('wallet')
    .description('Show or set up the Stacks wallet used by AgentSats')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleWallet(options, runtime)
    })

  walletCommand
    .command('setup')
    .description('Set up a wallet provider for AgentSats')
    .requiredOption('--provider <provider>', 'Wallet provider to set up')
    .option('--preview-stacks', 'Use the unreleased OWS Stacks preview build')
    .option('--wallet <name>', 'OWS wallet name')
    .option('--network <network>', 'Stacks network: mainnet or testnet')
    .option('--key-encoding <encoding>', 'Stacks key encoding: compressed or uncompressed')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async function handleSetupAction(this: Command, options: Record<string, unknown>) {
      runtime.exitCode = await handleWalletSetup({
        ...options,
        ...this.optsWithGlobals(),
      }, runtime)
    })
}
