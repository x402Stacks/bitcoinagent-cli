import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execute, FIXED_NOW } from './helpers/execute.js'

vi.mock('../src/services/transport.js', () => {
  return {
    getFreeTransport: () => ({
      get: vi.fn(async (path: string) => {
        if (path === '/api/v1/services') {
          return {
            data: {
              services: [
                { name: 'tiktok', has_paid_endpoints: false },
                { name: 'twitter', has_paid_endpoints: true },
              ],
            },
            provider: 'internal',
          }
        }
        if (path === '/api/v1/services/twitter/endpoints') {
          return {
            data: {
              service: 'twitter',
              endpoints: [
                {
                  method: 'GET',
                  path: '/api/v1/twitter/profile',
                  description: 'Fetch a Twitter profile',
                  query_params: ['username'],
                  payment: {
                    scheme: 'exact',
                    required: true,
                    enabled: false,
                    asset: 'STX',
                    amount: '1000',
                    network: 'testnet',
                  },
                },
              ],
            },
            provider: 'internal',
          }
        }
        if (path === '/api/v1/services/unknown/endpoints') {
          const { NotFoundError } = await import('../src/core/errors.js')
          throw new NotFoundError('not_found', { status: 404 })
        }
        throw new Error(`unexpected: ${path}`)
      }),
    }),
    getPaidTransport: vi.fn(),
  }
})

describe('services list — json', () => {
  it('returns services array with provider and timestamp', async () => {
    const r = await execute(['services', 'list', '--json'])
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(0)
    expect(r.stderr).toBe('')
    expect(p.success).toBe(true)
    expect(p.data.services).toHaveLength(2)
    expect(p.data.timestamp).toBe(FIXED_NOW)
    expect(r.stdout.trim().split('\n')).toHaveLength(1)
  })
})

describe('services endpoints <name> — json', () => {
  it('returns payment metadata', async () => {
    const r = await execute(['services', 'endpoints', 'twitter', '--json'])
    const p = JSON.parse(r.stdout)
    expect(p.success).toBe(true)
    expect(p.data.endpoints[0].payment.amount).toBe('1000')
  })

  it('returns NOT_FOUND for unknown service with exit code 2', async () => {
    const r = await execute(['services', 'endpoints', 'unknown', '--json'])
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(2)
    expect(p.success).toBe(false)
    expect(p.error.code).toBe('NOT_FOUND')
  })
})

describe('services list — plain', () => {
  it('emits key-value lines with no banner', async () => {
    const r = await execute(['services', 'list', '--plain'])
    expect(r.stdout).not.toContain('agent-first command line')
    expect(r.stdout).toContain('service: tiktok')
    expect(r.stdout).toContain('service: twitter')
  })
})

describe('services list — human', () => {
  it('renders the banner', async () => {
    const r = await execute(['services', 'list'])
    expect(r.stdout).toContain('agent-first command line')
  })
})