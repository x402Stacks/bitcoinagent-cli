import { describe, expect, it, vi } from 'vitest'
import { execute, FIXED_NOW } from './helpers/execute.js'

vi.mock('../src/services/transport.js', () => ({
  getFreeTransport: () => ({
    get: vi.fn(async (path: string) => {
      if (path === '/api/v1/services') {
        return { data: { services: [] }, provider: 'internal' }
      }
      throw new Error(`unexpected GET: ${path}`)
    }),
    getRaw: vi.fn(async (path: string) => {
      if (path === '/health') return { status: 'ok' }
      throw new Error(`unexpected getRaw: ${path}`)
    }),
  }),
  getPaidTransport: vi.fn(),
}))

describe('health — json', () => {
  it('returns status ok with timestamp', async () => {
    const r = await execute(['health', '--json'])
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(0)
    expect(r.stderr).toBe('')
    expect(p.success).toBe(true)
    expect(p.data.status).toBe('ok')
    expect(p.data.timestamp).toBe(FIXED_NOW)
  })
})

describe('health — plain', () => {
  it('emits status key-value lines with no banner', async () => {
    const r = await execute(['health', '--plain'])
    expect(r.stdout).not.toContain('agent-first command line')
    expect(r.stdout).toContain('status: ok')
  })
})

describe('health — human', () => {
  it('renders the banner', async () => {
    const r = await execute(['health'])
    expect(r.stdout).toContain('agent-first command line')
  })
})