import { runCli } from '../../src/cli.js'

export function createMemoryWriter() {
  let value = ''
  return {
    write(chunk: string | Uint8Array) {
      value += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
      return true
    },
    read: () => value,
  }
}

export const FIXED_NOW = '2026-04-16T00:00:00.000Z'
export const TEST_PRIVATE_KEY =
  '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'

export async function execute(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const stdout = createMemoryWriter()
  const stderr = createMemoryWriter()
  const exitCode = await runCli(argv, { stdout, stderr, now: () => FIXED_NOW, env })
  return { exitCode, stdout: stdout.read(), stderr: stderr.read() }
}