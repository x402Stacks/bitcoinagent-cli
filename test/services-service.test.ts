import { describe, expect, it } from 'vitest'
import { listServices, getServiceEndpoints } from '../src/services/services-service.js'

function fakeClient(data: unknown, provider = 'internal') {
  return { get: async () => ({ data, provider }) } as const
}

describe('services-service', () => {
  it('listServices returns result with timestamp and provider', async () => {
    const client = fakeClient({
      services: [
        { name: 'tiktok', has_paid_endpoints: false },
        { name: 'twitter', has_paid_endpoints: true },
      ],
    })
    const res = await listServices(client, '2026-04-16T00:00:00.000Z')
    expect(res.services).toHaveLength(2)
    expect(res.provider).toBe('internal')
    expect(res.timestamp).toBe('2026-04-16T00:00:00.000Z')
  })

  it('getServiceEndpoints returns result with service name and timestamp', async () => {
    const client = fakeClient({
      service: 'twitter',
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/twitter/profile',
          description: 'Fetch a Twitter profile by username',
          query_params: ['username'],
          payment: {
            scheme: 'exact',
            required: true,
            enabled: true,
            asset: 'STX',
            amount: '1000',
            network: 'testnet',
          },
        },
      ],
    })
    const res = await getServiceEndpoints(client, 'twitter', '2026-04-16T00:00:00.000Z')
    expect(res.service).toBe('twitter')
    expect(res.endpoints[0]?.payment?.amount).toBe('1000')
  })
})