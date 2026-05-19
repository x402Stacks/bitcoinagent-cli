import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { afterAll, describe, expect, it } from 'vitest'

import { runCli } from '../src/cli.js'

const TEST_PRIVATE_KEY =
  '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'
const ISOLATED_CONFIG_DIR = mkdtempSync(path.join(tmpdir(), 'agentsats-cli-json-'))
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

async function execute(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const stdout = createMemoryWriter()
  const stderr = createMemoryWriter()
  const isolatedEnv = env.AGENTSATS_HOME || env.AGENTSATS_CONFIG_PATH
    ? env
    : { AGENTSATS_CONFIG_PATH: ISOLATED_CONFIG_PATH, ...env }

  const exitCode = await runCli(argv, {
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

describe('json mode', () => {
  it('returns help without treating it as an error', async () => {
    const result = await execute(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage: agentsats')
    expect(result.stdout).not.toContain('run [options]')
    expect(result.stdout).not.toContain('status [options]')
  })

  it('does not expose hidden service commands in help', async () => {
    const result = await execute(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).not.toContain('twitch')
    expect(result.stdout).not.toContain('zillow')
  })

  it('treats the explicit help command as a success path', async () => {
    const result = await execute(['help', 'wallet'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage: agentsats wallet')
  })

  it('keeps help requests machine-safe in json mode', async () => {
    const result = await execute(['wallet', '--json', '--help'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns structured json for wallet', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(true)
    expect(payload.data.address).toMatch(/^SP[0-9A-Z]+$/)
    expect(payload.meta.mode).toBe('json')
  })

  it('returns removed run command as structured json validation error', async () => {
    const result = await execute(['run', '--task', 'draft plan', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain("unknown command 'run'")
    expect(payload.meta.mode).toBe('json')
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('returns removed status command as structured json validation error', async () => {
    const result = await execute(['status', '--id', 'task_draft_plan', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain("unknown command 'status'")
  })

  it('returns validation failures as structured json', async () => {
    const result = await execute(['wallet', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain('STACKS_PRIVATE_KEY')
  })

  it('returns internal failures as structured json', async () => {
    const result = await execute(['services', '--api-url', 'http://127.0.0.1:1', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
  })

  it('emits no extra logs in json mode', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })

    expect(result.stdout.trim().split('\n')).toHaveLength(1)
    expect(result.stderr).toBe('')
  })

  it('keeps json output free of banner text', async () => {
    const result = await execute(['wallet', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })

    expect(result.stdout).not.toContain('AgentSats command line')
  })
})
