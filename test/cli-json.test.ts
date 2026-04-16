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

describe('json mode', () => {
  it('returns help without treating it as an error', async () => {
    const result = await execute(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage: agent-cli')
  })

  it('treats the explicit help command as a success path', async () => {
    const result = await execute(['help', 'run'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage: agent-cli run')
  })

  it('keeps help requests machine-safe in json mode', async () => {
    const result = await execute(['run', '--json', '--help'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns structured json for run', async () => {
    const result = await execute(['run', '--task', 'draft plan', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(true)
    expect(payload.data.taskId).toBe('task_draft_plan')
    expect(payload.data.task).toBe('draft plan')
    expect(payload.data.steps).toEqual([
      'validate input',
      'plan work',
      'report completion',
    ])
    expect(payload.meta.mode).toBe('json')
  })

  it('returns structured json for status', async () => {
    const result = await execute(['status', '--id', 'task_draft_plan', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(true)
    expect(payload.data.taskId).toBe('task_draft_plan')
    expect(payload.data.status).toBe('completed')
    expect(payload.meta.mode).toBe('json')
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('returns validation failures as structured json', async () => {
    const result = await execute(['run', '--task', '   ', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns missing required flags as structured json', async () => {
    const result = await execute(['run', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toContain("required option '--task <string>'")
  })

  it('returns internal failures as structured json', async () => {
    const result = await execute(['status', '--id', 'explode', '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
  })

  it('emits no extra logs in json mode', async () => {
    const result = await execute(['run', '--task', 'draft plan', '--json'])

    expect(result.stdout.trim().split('\n')).toHaveLength(1)
    expect(result.stderr).toBe('')
  })

  it('keeps json output free of banner text', async () => {
    const result = await execute(['run', '--task', 'draft plan', '--json'])

    expect(result.stdout).not.toContain('agent-first command line')
  })

  it('keeps status json output free of banner text', async () => {
    const result = await execute(['status', '--id', 'task_draft_plan', '--json'])

    expect(result.stdout).not.toContain('agent-first command line')
  })
})
