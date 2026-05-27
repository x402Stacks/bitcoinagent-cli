import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import { runCli } from '../src/cli.js'
import type { RuntimeOptions } from '../src/types/context.js'
import { TEST_PRIVATE_KEY } from './fixtures.js'
const OWS_PREVIEW_COMMIT = '94e059363f172ed71fa72d7b0619508ae11ba0d1'
const OWS_PREVIEW_WARNING = 'Stacks support in OWS is still under development.'
const ISOLATED_CONFIG_DIR = mkdtempSync(path.join(tmpdir(), 'agentsats-cli-wallet-'))
const ISOLATED_CONFIG_PATH = path.join(ISOLATED_CONFIG_DIR, 'config.json')

afterAll(() => {
  rmSync(ISOLATED_CONFIG_DIR, { recursive: true, force: true })
})

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
  const isolatedEnv = env.AGENTSATS_HOME || env.AGENTSATS_CONFIG_PATH
    ? env
    : { AGENTSATS_CONFIG_PATH: ISOLATED_CONFIG_PATH, ...env }

  const exitCode = await runCli(argv, {
    ...options,
    stdout,
    stderr,
    now: () => '2026-04-16T00:00:00.000Z',
    env: isolatedEnv,
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

  it('defaults network to mainnet when STACKS_NETWORK is unset', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.success).toBe(true)
    expect(payload.data.network).toBe('mainnet')
    expect(payload.data.address).toMatch(/^SP[0-9A-Z]+$/)
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
    expect(payload.data.network).toBe('mainnet')
    expect(payload.data.address).toMatch(/^SP[0-9A-Z]+$/)
  })

  it('defaults OWS chain to mainnet when network and chain are unset', async () => {
    const result = await execute(
      ['wallet', '--json'],
      {
        AGENTSATS_WALLET_PROVIDER: 'ows',
        OWS_WALLET: 'agent-treasury',
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

  it('uses saved OWS wallet config when wallet environment variables are absent', async () => {
    const agentsatsHome = await mkdtemp(path.join(tmpdir(), 'agentsats-config-wallet-'))
    const owsCli = path.join(agentsatsHome, 'ows', 'pr-115', OWS_PREVIEW_COMMIT, 'ows', 'target', 'release', 'ows')

    try {
      await mkdir(agentsatsHome, { recursive: true })
      await writeFile(path.join(agentsatsHome, 'config.json'), `${JSON.stringify({
        wallet: {
          provider: 'ows',
          wallet: 'agentsats-mainnet',
          chain: 'stacks:1',
          cliPath: owsCli,
          keyEncoding: 'uncompressed',
          preview: {
            source: 'ows-pr-115',
            commit: OWS_PREVIEW_COMMIT,
          },
        },
      })}\n`)

      const result = await execute(
        ['wallet', '--json'],
        {
          AGENTSATS_HOME: agentsatsHome,
        },
        {
          commandRunner: async (command, args) => {
            expect(command).toBe(owsCli)
            expect(args).toEqual(['wallet', 'list'])

            return {
              stdout: [
                'ID:      wallet-1',
                'Name:    agentsats-mainnet',
                'Secured: yes',
                '  stacks:1 (stacks) -> SP21DDYJM3A6J086F0ZYGZJ24MRCTSTXED71J8DTS',
                'Created: 2026-05-15T00:00:00Z',
                '',
              ].join('\n'),
              stderr: '',
            }
          },
        },
      )
      const payload = JSON.parse(result.stdout)

      expect(result.exitCode).toBe(0)
      expect(payload.success).toBe(true)
      expect(payload.data.provider).toBe('ows')
      expect(payload.data.network).toBe('mainnet')
      expect(payload.data.address).toBe('SP21DDYJM3A6J086F0ZYGZJ24MRCTSTXED71J8DTS')
    } finally {
      await rm(agentsatsHome, { recursive: true, force: true })
    }
  })

  it('uses a named saved OWS wallet profile when --wallet is provided', async () => {
    const agentsatsHome = await mkdtemp(path.join(tmpdir(), 'agentsats-config-wallets-'))
    const mainnetOwsCli = path.join(agentsatsHome, 'ows', 'mainnet', 'ows')
    const testnetOwsCli = path.join(agentsatsHome, 'ows', 'testnet', 'ows')

    try {
      await mkdir(agentsatsHome, { recursive: true })
      await writeFile(path.join(agentsatsHome, 'config.json'), `${JSON.stringify({
        wallet: {
          provider: 'ows',
          wallet: 'agentsats-mainnet',
          chain: 'stacks:1',
          cliPath: mainnetOwsCli,
          keyEncoding: 'uncompressed',
          preview: {
            source: 'ows-pr-115',
            commit: OWS_PREVIEW_COMMIT,
          },
        },
        wallets: {
          'agentsats-mainnet': {
            provider: 'ows',
            wallet: 'agentsats-mainnet',
            chain: 'stacks:1',
            cliPath: mainnetOwsCli,
            keyEncoding: 'uncompressed',
            preview: {
              source: 'ows-pr-115',
              commit: OWS_PREVIEW_COMMIT,
            },
          },
          'agentsats-testnet': {
            provider: 'ows',
            wallet: 'agentsats-testnet',
            chain: 'stacks:2147483648',
            cliPath: testnetOwsCli,
            keyEncoding: 'uncompressed',
            preview: {
              source: 'ows-pr-115',
              commit: OWS_PREVIEW_COMMIT,
            },
          },
        },
      })}\n`)

      const result = await execute(
        ['wallet', '--wallet', 'agentsats-testnet', '--json'],
        {
          AGENTSATS_HOME: agentsatsHome,
        },
        {
          commandRunner: async (command, args) => {
            expect(command).toBe(testnetOwsCli)
            expect(args).toEqual(['wallet', 'list'])

            return {
              stdout: [
                'ID:      wallet-2',
                'Name:    agentsats-testnet',
                'Secured: yes',
                '  stacks:2147483648 (stacks) -> STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6',
                'Created: 2026-05-15T00:00:00Z',
                '',
              ].join('\n'),
              stderr: '',
            }
          },
        },
      )
      const payload = JSON.parse(result.stdout)

      expect(result.exitCode).toBe(0)
      expect(payload.success).toBe(true)
      expect(payload.data.provider).toBe('ows')
      expect(payload.data.network).toBe('testnet')
      expect(payload.data.address).toBe('STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6')
    } finally {
      await rm(agentsatsHome, { recursive: true, force: true })
    }
  })

  it('does not inherit the default OWS profile when --wallet selects an unsaved wallet', async () => {
    const agentsatsHome = await mkdtemp(path.join(tmpdir(), 'agentsats-missing-cli-wallet-'))
    const mainnetOwsCli = path.join(agentsatsHome, 'ows', 'mainnet', 'ows')

    try {
      await mkdir(agentsatsHome, { recursive: true })
      await writeFile(path.join(agentsatsHome, 'config.json'), `${JSON.stringify({
        wallet: {
          provider: 'ows',
          wallet: 'agentsats-mainnet',
          chain: 'stacks:1',
          cliPath: mainnetOwsCli,
          keyEncoding: 'uncompressed',
        },
        wallets: {
          'agentsats-mainnet': {
            provider: 'ows',
            wallet: 'agentsats-mainnet',
            chain: 'stacks:1',
            cliPath: mainnetOwsCli,
            keyEncoding: 'uncompressed',
          },
        },
      })}\n`)

      const result = await execute(
        ['wallet', '--wallet', 'agentsats-testnet', '--json'],
        {
          AGENTSATS_HOME: agentsatsHome,
          STACKS_NETWORK: 'testnet',
        },
        {
          commandRunner: async (command, args) => {
            expect(command).toBe('ows')
            expect(args).toEqual(['wallet', 'list'])

            return {
              stdout: [
                'ID:      wallet-2',
                'Name:    agentsats-testnet',
                'Secured: yes',
                '  stacks:2147483648 (stacks) -> STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6',
                'Created: 2026-05-15T00:00:00Z',
                '',
              ].join('\n'),
              stderr: '',
            }
          },
        },
      )
      const payload = JSON.parse(result.stdout)

      expect(result.exitCode).toBe(0)
      expect(payload.success).toBe(true)
      expect(payload.data.provider).toBe('ows')
      expect(payload.data.network).toBe('testnet')
      expect(payload.data.address).toBe('STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6')
    } finally {
      await rm(agentsatsHome, { recursive: true, force: true })
    }
  })

  it('does not inherit the default OWS profile when OWS_WALLET selects an unsaved wallet', async () => {
    const agentsatsHome = await mkdtemp(path.join(tmpdir(), 'agentsats-missing-env-wallet-'))
    const mainnetOwsCli = path.join(agentsatsHome, 'ows', 'mainnet', 'ows')

    try {
      await mkdir(agentsatsHome, { recursive: true })
      await writeFile(path.join(agentsatsHome, 'config.json'), `${JSON.stringify({
        wallet: {
          provider: 'ows',
          wallet: 'agentsats-mainnet',
          chain: 'stacks:1',
          cliPath: mainnetOwsCli,
          keyEncoding: 'uncompressed',
        },
        wallets: {
          'agentsats-mainnet': {
            provider: 'ows',
            wallet: 'agentsats-mainnet',
            chain: 'stacks:1',
            cliPath: mainnetOwsCli,
            keyEncoding: 'uncompressed',
          },
        },
      })}\n`)

      const result = await execute(
        ['wallet', '--json'],
        {
          AGENTSATS_HOME: agentsatsHome,
          OWS_WALLET: 'agentsats-testnet',
          STACKS_NETWORK: 'testnet',
        },
        {
          commandRunner: async (command, args) => {
            expect(command).toBe('ows')
            expect(args).toEqual(['wallet', 'list'])

            return {
              stdout: [
                'ID:      wallet-2',
                'Name:    agentsats-testnet',
                'Secured: yes',
                '  stacks:2147483648 (stacks) -> STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6',
                'Created: 2026-05-15T00:00:00Z',
                '',
              ].join('\n'),
              stderr: '',
            }
          },
        },
      )
      const payload = JSON.parse(result.stdout)

      expect(result.exitCode).toBe(0)
      expect(payload.success).toBe(true)
      expect(payload.data.provider).toBe('ows')
      expect(payload.data.network).toBe('testnet')
      expect(payload.data.address).toBe('STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6')
    } finally {
      await rm(agentsatsHome, { recursive: true, force: true })
    }
  })
})

describe('wallet setup command — json mode', () => {
  it('rejects OWS setup unless the Stacks preview flag is explicit', async () => {
    const result = await execute([
      'wallet',
      'setup',
      '--provider',
      'ows',
      '--wallet',
      'agentsats-mainnet',
      '--network',
      'mainnet',
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain('--preview-stacks')
  })

  it('builds the pinned OWS Stacks preview, creates a wallet, and saves non-secret config', async () => {
    const agentsatsHome = await mkdtemp(path.join(tmpdir(), 'agentsats-ows-preview-'))
    const sourceDir = path.join(agentsatsHome, 'ows', 'pr-115', OWS_PREVIEW_COMMIT)
    const calls: {
      command: string
      args: readonly string[]
      cwd?: string
    }[] = []

    try {
      await mkdir(sourceDir, { recursive: true })

      const result = await execute(
        [
          'wallet',
          'setup',
          '--provider',
          'ows',
          '--preview-stacks',
          '--wallet',
          'agentsats-mainnet',
          '--json',
        ],
        {
          AGENTSATS_HOME: agentsatsHome,
        },
        {
          commandRunner: async (command, args, options) => {
            calls.push({ command, args, cwd: options?.cwd })

            if (command === 'git' && args[0] === '--version') {
              return { stdout: 'git version 2.50.0\n', stderr: '' }
            }

            if (command === 'cargo' && args[0] === '--version') {
              return { stdout: 'cargo 1.90.0\n', stderr: '' }
            }

            if (command === 'git' && args[0] === 'clone') {
              return { stdout: '', stderr: '' }
            }

            if (command === 'git' && args[0] === 'checkout') {
              return { stdout: '', stderr: '' }
            }

            if (command === 'cargo' && args[0] === 'build') {
              return { stdout: '', stderr: '' }
            }

            if (command.endsWith('/ows') && args[0] === 'wallet' && args[1] === 'list') {
              const walletListCalls = calls.filter((call) => (
                call.command.endsWith('/ows') &&
                call.args[0] === 'wallet' &&
                call.args[1] === 'list'
              ))

              if (walletListCalls.length === 1) {
                throw new Error('OWS vault is not initialized')
              }

              return {
                stdout: [
                  'ID:      wallet-1',
                  'Name:    agentsats-mainnet',
                  'Secured: yes',
                  '  stacks:1 (stacks) -> SP21DDYJM3A6J086F0ZYGZJ24MRCTSTXED71J8DTS',
                  'Created: 2026-05-15T00:00:00Z',
                  '',
                ].join('\n'),
                stderr: '',
              }
            }

            if (command.endsWith('/ows') && args[0] === 'wallet' && args[1] === 'create') {
              return { stdout: 'Wallet created\n', stderr: '' }
            }

            throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
          },
        },
      )
      const payload = JSON.parse(result.stdout)
      const owsCli = path.join(sourceDir, 'ows', 'target', 'release', 'ows')
      const configPath = path.join(agentsatsHome, 'config.json')
      const config = JSON.parse(await readFile(configPath, 'utf8'))

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(payload.success).toBe(true)
      expect(payload.data.warning).toBe(OWS_PREVIEW_WARNING)
      expect(payload.data.provider).toBe('ows')
      expect(payload.data.preview).toBe(true)
      expect(payload.data.wallet).toBe('agentsats-mainnet')
      expect(payload.data.network).toBe('mainnet')
      expect(payload.data.chain).toBe('stacks:1')
      expect(payload.data.address).toBe('SP21DDYJM3A6J086F0ZYGZJ24MRCTSTXED71J8DTS')
      expect(payload.data.owsCli).toBe(owsCli)
      expect(payload.data.sourceDir).toBe(sourceDir)
      expect(payload.data.commit).toBe(OWS_PREVIEW_COMMIT)
      expect(payload.data.configPath).toBe(configPath)
      expect(config.wallet).toEqual({
        provider: 'ows',
        wallet: 'agentsats-mainnet',
        chain: 'stacks:1',
        cliPath: owsCli,
        keyEncoding: 'uncompressed',
        preview: {
          source: 'ows-pr-115',
          commit: OWS_PREVIEW_COMMIT,
        },
      })
      expect(calls.map((call) => [call.command, ...call.args])).toEqual([
        ['git', '--version'],
        ['cargo', '--version'],
        ['git', 'clone', 'https://github.com/tony1908/core.git', sourceDir],
        ['git', 'checkout', OWS_PREVIEW_COMMIT],
        ['cargo', 'build', '--release', '--bin', 'ows'],
        [owsCli, 'wallet', 'list'],
        [owsCli, 'wallet', 'create', '--name', 'agentsats-mainnet'],
        [owsCli, 'wallet', 'list'],
      ])
      expect(calls.find((call) => call.command === 'git' && call.args[0] === 'checkout')?.cwd).toBe(sourceDir)
      expect(calls.find((call) => call.command === 'cargo' && call.args[0] === 'build')?.cwd)
        .toBe(path.join(sourceDir, 'ows'))
    } finally {
      await rm(agentsatsHome, { recursive: true, force: true })
    }
  })

  it('preserves existing OWS wallet profiles when setup adds a new wallet', async () => {
    const agentsatsHome = await mkdtemp(path.join(tmpdir(), 'agentsats-ows-multi-preview-'))
    const sourceDir = path.join(agentsatsHome, 'ows', 'pr-115', OWS_PREVIEW_COMMIT)
    const existingOwsCli = path.join(agentsatsHome, 'ows', 'existing', 'ows')

    try {
      await mkdir(path.join(sourceDir, '.git'), { recursive: true })
      await writeFile(path.join(agentsatsHome, 'config.json'), `${JSON.stringify({
        wallet: {
          provider: 'ows',
          wallet: 'agentsats-mainnet',
          chain: 'stacks:1',
          cliPath: existingOwsCli,
          keyEncoding: 'uncompressed',
          preview: {
            source: 'ows-pr-115',
            commit: OWS_PREVIEW_COMMIT,
          },
        },
        wallets: {
          'agentsats-mainnet': {
            provider: 'ows',
            wallet: 'agentsats-mainnet',
            chain: 'stacks:1',
            cliPath: existingOwsCli,
            keyEncoding: 'uncompressed',
            preview: {
              source: 'ows-pr-115',
              commit: OWS_PREVIEW_COMMIT,
            },
          },
        },
      })}\n`)

      const result = await execute(
        [
          'wallet',
          'setup',
          '--provider',
          'ows',
          '--preview-stacks',
          '--wallet',
          'agentsats-testnet',
          '--network',
          'testnet',
          '--json',
        ],
        {
          AGENTSATS_HOME: agentsatsHome,
        },
        {
          commandRunner: async (command, args) => {
            if (command === 'git' && args[0] === '--version') {
              return { stdout: 'git version 2.50.0\n', stderr: '' }
            }

            if (command === 'cargo' && args[0] === '--version') {
              return { stdout: 'cargo 1.90.0\n', stderr: '' }
            }

            if (command === 'git' && args[0] === 'checkout') {
              return { stdout: '', stderr: '' }
            }

            if (command === 'cargo' && args[0] === 'build') {
              return { stdout: '', stderr: '' }
            }

            if (command.endsWith('/ows') && args[0] === 'wallet' && args[1] === 'list') {
              return {
                stdout: [
                  'ID:      wallet-2',
                  'Name:    agentsats-testnet',
                  'Secured: yes',
                  '  stacks:2147483648 (stacks) -> STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6',
                  'Created: 2026-05-15T00:00:00Z',
                  '',
                ].join('\n'),
                stderr: '',
              }
            }

            throw new Error(`unexpected command: ${command} ${args.join(' ')}`)
          },
        },
      )
      const payload = JSON.parse(result.stdout)
      const config = JSON.parse(await readFile(path.join(agentsatsHome, 'config.json'), 'utf8'))

      expect(result.exitCode).toBe(0)
      expect(payload.success).toBe(true)
      expect(config.wallet.wallet).toBe('agentsats-testnet')
      expect(config.wallet.chain).toBe('stacks:2147483648')
      expect(config.wallets['agentsats-mainnet'].cliPath).toBe(existingOwsCli)
      expect(config.wallets['agentsats-testnet'].wallet).toBe('agentsats-testnet')
      expect(config.wallets['agentsats-testnet'].chain).toBe('stacks:2147483648')
    } finally {
      await rm(agentsatsHome, { recursive: true, force: true })
    }
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
