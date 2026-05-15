import { describe, expect, it } from 'vitest'

import {
  createX402PaymentSignatureHeader,
  injectStacksSignature,
  parseOwsSignTxSignature,
} from '../src/services/x402-payment.js'
import type { CommandRunner } from '../src/types/context.js'

const OWS_ADDRESS = 'SP21DDYJM3A6J086F0ZYGZJ24MRCTSTXED71J8DTS'
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
})
