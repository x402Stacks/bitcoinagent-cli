import { describe, expect, it } from 'vitest'

import { runCli } from '../src/cli.js'
import type { RuntimeOptions } from '../src/types/context.js'

const TEST_PRIVATE_KEY =
  '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'

function createMemoryWriter() {
  let value = ''

  return {
    write(chunk: string | Uint8Array) {
      value += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
      return true
    },
    read() {
      return value
    },
  }
}

async function execute(
  argv: string[],
  env: NodeJS.ProcessEnv = {},
  options: Omit<RuntimeOptions, 'stdout' | 'stderr' | 'now' | 'env'> = {},
) {
  const stdout = createMemoryWriter()
  const stderr = createMemoryWriter()

  const exitCode = await runCli(argv, {
    ...options,
    stdout,
    stderr,
    now: () => '2026-04-16T00:00:00.000Z',
    env,
  })

  return {
    exitCode,
    stdout: stdout.read(),
    stderr: stderr.read(),
  }
}

describe('wallet command — json mode', () => {
  it('returns address and network from env', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
      STACKS_NETWORK: 'mainnet',
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(true)
    expect(payload.data.provider).toBe('private-key')
    expect(payload.data.network).toBe('mainnet')
    expect(payload.data.address).toMatch(/^SP[0-9A-Z]+$/)
    expect(payload.data.timestamp).toBe('2026-04-16T00:00:00.000Z')
    expect(payload.meta.mode).toBe('json')
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('defaults network to testnet when STACKS_NETWORK is unset', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.success).toBe(true)
    expect(payload.data.network).toBe('testnet')
    expect(payload.data.address).toMatch(/^ST[0-9A-Z]+$/)
  })

  it('preserves private-key behavior when provider is explicit', async () => {
    const result = await execute(['wallet', '--json'], {
      AGENTSATS_WALLET_PROVIDER: 'private-key',
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.success).toBe(true)
    expect(payload.data.provider).toBe('private-key')
    expect(payload.data.address).toMatch(/^ST[0-9A-Z]+$/)
  })

  it('returns validation error for an invalid wallet provider', async () => {
    const result = await execute(['wallet', '--json'], {
      AGENTSATS_WALLET_PROVIDER: 'hardware',
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain('AGENTSATS_WALLET_PROVIDER')
  })

  it('returns validation error when OWS wallet name is missing', async () => {
    const result = await execute(['wallet', '--json'], {
      AGENTSATS_WALLET_PROVIDER: 'ows',
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain('OWS_WALLET')
  })

  it('returns the selected OWS Stacks account from wallet list output', async () => {
    const result = await execute(
      ['wallet', '--json'],
      {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'agent-treasury',
        STACKS_NETWORK: 'mainnet',
      },
      {
        commandRunner: async () => ({
          stdout: [
            'ID:      wallet-1',
            'Name:    agent-treasury',
            'Secured: yes',
            '  stacks:1 (stacks) -> SP1234567890ABCDEFGHJKMNPQRSTVWXYZ',
            'Created: 2026-05-14T00:00:00Z',
            '',
          ].join('\n'),
          stderr: '',
        }),
      },
    )
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.success).toBe(true)
    expect(payload.data.provider).toBe('ows')
    expect(payload.data.network).toBe('mainnet')
    expect(payload.data.address).toBe('SP1234567890ABCDEFGHJKMNPQRSTVWXYZ')
  })

  it('returns validation error when STACKS_PRIVATE_KEY is missing', async () => {
    const result = await execute(['wallet', '--json'], {})
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain('STACKS_PRIVATE_KEY')
  })

  it('returns validation error when STACKS_NETWORK is invalid', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
      STACKS_NETWORK: 'devnet',
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain('STACKS_NETWORK')
  })

  it('keeps json output free of banner text', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })

    expect(result.stdout).not.toContain('AgentSats command line')
  })
})

describe('wallet command — plain mode', () => {
  it('emits key-value lines with no banner', async () => {
    const result = await execute(['wallet', '--plain'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
      STACKS_NETWORK: 'mainnet',
    })

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).not.toContain('AgentSats command line')
    expect(result.stdout).toContain('network: mainnet')
    expect(result.stdout).toMatch(/address: SP[0-9A-Z]+/)
    expect(result.stdout).toContain('timestamp: 2026-04-16T00:00:00.000Z')
  })
})

describe('wallet command — human mode', () => {
  it('renders the banner', async () => {
    const result = await execute(['wallet'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('AgentSats command line')
  })
})
