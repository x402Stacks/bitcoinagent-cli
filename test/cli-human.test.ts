import { describe, expect, it } from 'vitest'

import { runCli } from '../src/cli.js'

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

async function execute(argv: string[]) {
  const stdout = createMemoryWriter()
  const stderr = createMemoryWriter()

  const exitCode = await runCli(argv, {
    stdout,
    stderr,
    now: () => '2026-04-16T00:00:00.000Z',
  })

  return {
    exitCode,
    stdout: stdout.read(),
    stderr: stderr.read(),
  }
}

describe('human banner', () => {
  it('renders the banner in human run output', async () => {
    const result = await execute(['run', '--task', 'draft plan'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('agent-first command line')
  })

  it('does not render the banner in plain mode', async () => {
    const result = await execute(['run', '--task', 'draft plan', '--plain'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('agent-first command line')
  })

  it('does not render the banner in plain status mode', async () => {
    const result = await execute(['status', '--id', 'task_draft_plan', '--plain'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('agent-first command line')
  })

  it('renders the banner in human status output', async () => {
    const result = await execute(['status', '--id', 'task_draft_plan'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('agent-first command line')
  })
})
