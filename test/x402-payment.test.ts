import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createX402PaymentSignatureHeader,
  injectStacksSignature,
  parseOwsSignTxSignature,
} from '../src/services/x402-payment.js'
import type { CommandRunner, FetchLike } from '../src/types/context.js'

function createFeeEstimateFetcher(feesUstx: readonly number[]) {
  const state = { calls: 0 }
  const fetcher: FetchLike = async (input) => {
    const url = String(input)

    if (url.endsWith('/v2/fees/transaction')) {
      const fee = feesUstx[Math.min(state.calls, feesUstx.length - 1)]
      state.calls += 1
      return new Response(JSON.stringify({
        estimations: [{ fee }, { fee }, { fee }],
        cost_scalar_change_by_byte: 0,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    throw new Error(`unexpected fetch: ${url}`)
  }

  return { fetcher, state }
}

function createRecordingSleep() {
  const calls: number[] = []
  const sleep = async (ms: number) => {
    calls.push(ms)
  }

  return { sleep, calls }
}

const OWS_ADDRESS = 'SP21DDYJM3A6J086F0ZYGZJ24MRCTSTXED71J8DTS'
const OWS_TESTNET_ADDRESS = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6'
const OWS_PREVIEW_COMMIT = '94e059363f172ed71fa72d7b0619508ae11ba0d1'
const PAYMENT_REQUIRED = {
  x402Version: 2,
  resource: {
    url: '/api/v1/twitter/profile',
    description: 'Fetch a Twitter profile by username',
    mimeType: 'application/json',
  },
  accepts: [
    {
      scheme: 'exact',
      network: 'stacks:1',
      amount: '1000',
      asset: 'STX',
      payTo: 'SP2WJH5SDW4S374V3J154SW0SRE20NV1ZKTBCXMR6',
      maxTimeoutSeconds: 30,
      resource: '/api/v1/twitter/profile',
      description: 'Fetch a Twitter profile by username',
      mimeType: 'application/json',
    },
  ],
} as const

const TESTNET_PAYMENT_REQUIRED = {
  x402Version: 2,
  resource: {
    url: '/api/v1/twitter/profile',
    description: 'Fetch a Twitter profile by username',
    mimeType: 'application/json',
  },
  accepts: [
    {
      scheme: 'exact',
      network: 'stacks:2147483648',
      amount: '1000',
      asset: 'STX',
      payTo: OWS_TESTNET_ADDRESS,
      maxTimeoutSeconds: 30,
      resource: '/api/v1/twitter/profile',
      description: 'Fetch a Twitter profile by username',
      mimeType: 'application/json',
    },
  ],
} as const

describe('x402 payment signing', () => {
  it('parses OWS JSON and raw transaction signatures', () => {
    const signature = `01${'11'.repeat(64)}`

    expect(parseOwsSignTxSignature(JSON.stringify({ signature, recovery_id: 1 }))).toBe(signature)
    expect(parseOwsSignTxSignature(`0x${signature}`)).toBe(signature)
  })

  it('injects a Stacks VRS signature into standard single-sig transaction bytes', () => {
    const prefix = 'aa'.repeat(44)
    const placeholder = '00'.repeat(65)
    const suffix = 'bb'.repeat(10)
    const signature = `01${'22'.repeat(64)}`

    expect(injectStacksSignature(`${prefix}${placeholder}${suffix}`, signature)).toBe(`${prefix}${signature}${suffix}`)
  })

  it('creates an x402 payment header from an OWS Stacks wallet signature', async () => {
    const signature = `01${'33'.repeat(64)}`
    let unsignedTransaction = ''
    const calls: { command: string; args: readonly string[] }[] = []
    const commandRunner: CommandRunner = async (command, args) => {
      calls.push({ command, args })

      if (args[0] === 'wallet' && args[1] === 'list') {
        return {
          stdout: [
            'ID:      wallet-1',
            'Name:    x402-test',
            'Secured: yes',
            `  stacks:1 (stacks) -> ${OWS_ADDRESS}`,
            'Created: 2026-05-14T00:00:00Z',
            '',
          ].join('\n'),
          stderr: '',
        }
      }

      if (args[0] === 'sign' && args[1] === 'tx') {
        const txIndex = args.indexOf('--tx')
        unsignedTransaction = String(args[txIndex + 1])
        return {
          stdout: JSON.stringify({ signature, recovery_id: 1 }),
          stderr: '',
        }
      }

      throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
    }

    const header = await createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'x402-test',
        OWS_CHAIN: 'stacks:1',
        OWS_CLI: 'ows',
      },
      commandRunner,
      fee: 180n,
      nonce: 0n,
    })
    const payload = JSON.parse(Buffer.from(header ?? '', 'base64').toString('utf8'))

    expect(header).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(calls.map((call) => call.args.slice(0, 2))).toEqual([
      ['wallet', 'list'],
      ['sign', 'tx'],
    ])
    expect(calls[1]?.args).toContain('--json')
    expect(calls[1]?.args).toContain('stacks:1')
    expect(payload.resource).toBeUndefined()
    expect(payload.accepted.network).toBe('stacks:1')
    expect(payload.payload.transaction).toBe(injectStacksSignature(unsignedTransaction, signature))
  })

  it('selects a named saved OWS wallet profile when creating a payment header', async () => {
    const agentsatsHome = mkdtempSync(path.join(tmpdir(), 'agentsats-x402-wallets-'))
    const selectedOwsCli = path.join(agentsatsHome, 'ows', 'testnet', 'ows')
    const signature = `01${'44'.repeat(64)}`
    let unsignedTransaction = ''
    const calls: { command: string; args: readonly string[] }[] = []

    try {
      mkdirSync(agentsatsHome, { recursive: true })
      writeFileSync(path.join(agentsatsHome, 'config.json'), `${JSON.stringify({
        wallet: {
          provider: 'ows',
          wallet: 'agentsats-mainnet',
          chain: 'stacks:1',
          cliPath: path.join(agentsatsHome, 'ows', 'mainnet', 'ows'),
          keyEncoding: 'uncompressed',
          preview: {
            source: 'ows-pr-115',
            commit: OWS_PREVIEW_COMMIT,
          },
        },
        wallets: {
          'agentsats-testnet': {
            provider: 'ows',
            wallet: 'agentsats-testnet',
            chain: 'stacks:2147483648',
            cliPath: selectedOwsCli,
            keyEncoding: 'uncompressed',
            preview: {
              source: 'ows-pr-115',
              commit: OWS_PREVIEW_COMMIT,
            },
          },
        },
      })}\n`, 'utf8')

      const commandRunner: CommandRunner = async (command, args) => {
        calls.push({ command, args })

        if (args[0] === 'wallet' && args[1] === 'list') {
          return {
            stdout: [
              'ID:      wallet-2',
              'Name:    agentsats-testnet',
              'Secured: yes',
              `  stacks:2147483648 (stacks) -> ${OWS_TESTNET_ADDRESS}`,
              'Created: 2026-05-14T00:00:00Z',
              '',
            ].join('\n'),
            stderr: '',
          }
        }

        if (args[0] === 'sign' && args[1] === 'tx') {
          const txIndex = args.indexOf('--tx')
          unsignedTransaction = String(args[txIndex + 1])
          return {
            stdout: JSON.stringify({ signature, recovery_id: 1 }),
            stderr: '',
          }
        }

        throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
      }

      const header = await createX402PaymentSignatureHeader(TESTNET_PAYMENT_REQUIRED, {
        env: {
          AGENTSATS_HOME: agentsatsHome,
        },
        commandRunner,
        fee: 180n,
        nonce: 0n,
        walletName: 'agentsats-testnet',
      })
      const payload = JSON.parse(Buffer.from(header ?? '', 'base64').toString('utf8'))

      expect(header).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(calls[0]?.command).toBe(selectedOwsCli)
      expect(calls[1]?.command).toBe(selectedOwsCli)
      expect(calls[1]?.args).toContain('stacks:2147483648')
      expect(calls[1]?.args).toContain('agentsats-testnet')
      expect(payload.accepted.network).toBe('stacks:2147483648')
      expect(payload.payload.transaction).toBe(injectStacksSignature(unsignedTransaction, signature))
    } finally {
      rmSync(agentsatsHome, { recursive: true, force: true })
    }
  })

  it('uses a fee estimate under the cap as-is with a single estimate call and no sleeping', async () => {
    const signature = `01${'55'.repeat(64)}`
    let unsignedTransaction = ''
    const { fetcher, state: feeState } = createFeeEstimateFetcher([100])
    const { sleep, calls: sleepCalls } = createRecordingSleep()

    const commandRunner: CommandRunner = async (command, args) => {
      if (args[0] === 'wallet' && args[1] === 'list') {
        return {
          stdout: [
            'ID:      wallet-1',
            'Name:    x402-test',
            'Secured: yes',
            `  stacks:1 (stacks) -> ${OWS_ADDRESS}`,
            'Created: 2026-05-14T00:00:00Z',
            '',
          ].join('\n'),
          stderr: '',
        }
      }

      if (args[0] === 'sign' && args[1] === 'tx') {
        const txIndex = args.indexOf('--tx')
        unsignedTransaction = String(args[txIndex + 1])
        return {
          stdout: JSON.stringify({ signature, recovery_id: 1 }),
          stderr: '',
        }
      }

      throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
    }

    const header = await createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'x402-test',
        OWS_CHAIN: 'stacks:1',
        OWS_CLI: 'ows',
      },
      commandRunner,
      fetcher,
      sleep,
      nonce: 0n,
    })

    expect(header).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(feeState.calls).toBe(1)
    expect(sleepCalls).toHaveLength(0)
    expect(unsignedTransaction.length).toBeGreaterThan(0)
  })

  it('retries the estimate after an over-cap result and succeeds once it drops under the cap', async () => {
    const signature = `01${'66'.repeat(64)}`
    const { fetcher, state: feeState } = createFeeEstimateFetcher([10000, 100])
    const { sleep, calls: sleepCalls } = createRecordingSleep()

    const commandRunner: CommandRunner = async (command, args) => {
      if (args[0] === 'wallet' && args[1] === 'list') {
        return {
          stdout: [
            'ID:      wallet-1',
            'Name:    x402-test',
            'Secured: yes',
            `  stacks:1 (stacks) -> ${OWS_ADDRESS}`,
            'Created: 2026-05-14T00:00:00Z',
            '',
          ].join('\n'),
          stderr: '',
        }
      }

      if (args[0] === 'sign' && args[1] === 'tx') {
        return {
          stdout: JSON.stringify({ signature, recovery_id: 1 }),
          stderr: '',
        }
      }

      throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
    }

    const header = await createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'x402-test',
        OWS_CHAIN: 'stacks:1',
        OWS_CLI: 'ows',
      },
      commandRunner,
      fetcher,
      sleep,
      nonce: 0n,
    })

    expect(header).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(feeState.calls).toBe(2)
    expect(sleepCalls).toEqual([2000])
  })

  it('fails closed with FEE_TOO_HIGH when every estimate stays over the cap, without signing', async () => {
    const calls: { command: string; args: readonly string[] }[] = []
    const { fetcher, state: feeState } = createFeeEstimateFetcher([10000])
    const { sleep, calls: sleepCalls } = createRecordingSleep()

    const commandRunner: CommandRunner = async (command, args) => {
      calls.push({ command, args })

      if (args[0] === 'wallet' && args[1] === 'list') {
        return {
          stdout: [
            'ID:      wallet-1',
            'Name:    x402-test',
            'Secured: yes',
            `  stacks:1 (stacks) -> ${OWS_ADDRESS}`,
            'Created: 2026-05-14T00:00:00Z',
            '',
          ].join('\n'),
          stderr: '',
        }
      }

      throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
    }

    await expect(createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'x402-test',
        OWS_CHAIN: 'stacks:1',
        OWS_CLI: 'ows',
      },
      commandRunner,
      fetcher,
      sleep,
      nonce: 0n,
    })).rejects.toMatchObject({ code: 'FEE_TOO_HIGH' })

    expect(feeState.calls).toBe(4)
    expect(sleepCalls).toHaveLength(3)
    expect(calls.some((call) => call.args[0] === 'sign' && call.args[1] === 'tx')).toBe(false)
  })

  it('honors env overrides and rejects an invalid fee cap env value', async () => {
    const signature = `01${'77'.repeat(64)}`
    const { fetcher, state: feeState } = createFeeEstimateFetcher([10000])
    const { sleep, calls: sleepCalls } = createRecordingSleep()

    const commandRunner: CommandRunner = async (command, args) => {
      if (args[0] === 'wallet' && args[1] === 'list') {
        return {
          stdout: [
            'ID:      wallet-1',
            'Name:    x402-test',
            'Secured: yes',
            `  stacks:1 (stacks) -> ${OWS_ADDRESS}`,
            'Created: 2026-05-14T00:00:00Z',
            '',
          ].join('\n'),
          stderr: '',
        }
      }

      if (args[0] === 'sign' && args[1] === 'tx') {
        return {
          stdout: JSON.stringify({ signature, recovery_id: 1 }),
          stderr: '',
        }
      }

      throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
    }

    await expect(createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'x402-test',
        OWS_CHAIN: 'stacks:1',
        OWS_CLI: 'ows',
        AGENTSATS_MAX_FEE_USTX: '20000',
        AGENTSATS_FEE_MAX_RETRIES: '1',
        AGENTSATS_FEE_RETRY_DELAY_MS: '5',
      },
      commandRunner,
      fetcher,
      sleep,
      nonce: 0n,
    })).resolves.toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(feeState.calls).toBe(1)
    expect(sleepCalls).toHaveLength(0)

    await expect(createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'x402-test',
        OWS_CHAIN: 'stacks:1',
        OWS_CLI: 'ows',
        AGENTSATS_MAX_FEE_USTX: 'abc',
      },
      commandRunner,
      fetcher,
      sleep,
      nonce: 0n,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('fails closed on the private-key path when the estimate stays over the cap', async () => {
    const { fetcher } = createFeeEstimateFetcher([10000])
    const { sleep, calls: sleepCalls } = createRecordingSleep()
    const commandRunner: CommandRunner = async (command, args) => {
      throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
    }

    await expect(createX402PaymentSignatureHeader(PAYMENT_REQUIRED, {
      env: {
        STACKS_PRIVATE_KEY: 'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01',
        STACKS_NETWORK: 'mainnet',
        AGENTSATS_FEE_MAX_RETRIES: '1',
      },
      commandRunner,
      fetcher,
      sleep,
      nonce: 0n,
    })).rejects.toMatchObject({ code: 'FEE_TOO_HIGH' })

    expect(sleepCalls.length).toBeGreaterThan(0)
  })
})
