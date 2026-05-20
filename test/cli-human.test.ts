import { describe, expect, it } from 'vitest'

import { runCli } from '../src/cli.js'
import { TEST_PRIVATE_KEY } from './fixtures.js'

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

  const exitCode = await runCli(argv, {
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

describe('human banner', () => {
  it('renders the banner in human wallet output', async () => {
    const result = await execute(['wallet'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('AgentSats command line')
  })

  it('does not render the banner in plain mode', async () => {
    const result = await execute(['wallet', '--plain'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('AgentSats command line')
    expect(result.stdout).toContain('provider: private-key')
  })
})
