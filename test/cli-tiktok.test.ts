import { describe, expect, it, vi } from 'vitest'
import { execute, FIXED_NOW } from './helpers/execute.js'

vi.mock('../src/services/transport.js', () => ({
  getFreeTransport: () => ({
    get: async (path: string, params?: Record<string, string>) => {
      if (path === '/api/v1/tiktok/profile' && params?.username === 'creator_1') {
        return {
          data: { Username: 'creator_1', DisplayName: 'Creator One', Followers: 1200 },
          provider: 'mock',
        }
      }
      if (path === '/api/v1/tiktok/videos' && params?.username === 'creator_1') {
        return { data: [{ ID: 'v1', Title: 'First', Views: 50_000 }], provider: 'mock' }
      }
      if (path === '/api/v1/tiktok/profile' && params?.username === 'boom') {
        const { UpstreamError } = await import('../src/core/errors.js')
        throw new UpstreamError('provider down', { status: 502 })
      }
      throw new Error(`unexpected: ${path} ${JSON.stringify(params)}`)
    },
  }),
  getPaidTransport: vi.fn(),
}))

describe('tiktok profile — json', () => {
  it('returns profile with provider + timestamp', async () => {
    const r = await execute(['tiktok', 'profile', '--username', 'creator_1', '--json'])
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(0)
    expect(p.data.Username).toBe('creator_1')
    expect(p.data.provider).toBe('mock')
    expect(p.data.timestamp).toBe(FIXED_NOW)
  })

  it('returns VALIDATION_ERROR when --username missing', async () => {
    const r = await execute(['tiktok', 'profile', '--json'])
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(1)
    expect(p.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns UPSTREAM_ERROR with exit 3 on provider failure', async () => {
    const r = await execute(['tiktok', 'profile', '--username', 'boom', '--json'])
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(3)
    expect(p.error.code).toBe('UPSTREAM_ERROR')
  })
})

describe('tiktok videos — json', () => {
  it('returns videos array', async () => {
    const r = await execute(['tiktok', 'videos', '--username', 'creator_1', '--json'])
    const p = JSON.parse(r.stdout)
    expect(p.data.videos).toHaveLength(1)
  })
})

describe('tiktok — plain/human', () => {
  it('plain omits banner, includes key-value lines', async () => {
    const r = await execute(['tiktok', 'profile', '--username', 'creator_1', '--plain'])
    expect(r.stdout).not.toContain('agent-first command line')
    expect(r.stdout).toContain('username: creator_1')
  })
  it('human includes banner', async () => {
    const r = await execute(['tiktok', 'profile', '--username', 'creator_1'])
    expect(r.stdout).toContain('agent-first command line')
  })
})