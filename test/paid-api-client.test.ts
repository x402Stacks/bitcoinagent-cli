import { describe, expect, it } from 'vitest'
import { createPaidClient } from '../src/services/paid-api-client.js'
import { PaymentRequiredError, UpstreamError, ValidationError } from '../src/core/errors.js'

type FakeAxios = { get: (path: string, opts?: unknown) => Promise<unknown> }

function fakeApi(impl: FakeAxios['get']): FakeAxios {
  return { get: impl }
}

describe('createPaidClient', () => {
  const config = { baseURL: 'https://api.test', timeoutMs: 1_000 }

  it('returns unwrapped envelope on success', async () => {
    const api = fakeApi(async () => ({
      status: 200,
      data: { data: { ok: true }, meta: { provider: 'rapidapi' } },
    }))
    const client = createPaidClient(config, { api })
    expect(await client.get('/api/v1/twitter/profile', { username: 'mr' })).toEqual({
      data: { ok: true },
      provider: 'rapidapi',
    })
  })

  it('maps 402 after failed settlement to PaymentRequiredError', async () => {
    const api = fakeApi(async () => {
      const err = new Error('Request failed')
      ;(err as any).response = { status: 402, data: {} }
      throw err
    })
    const client = createPaidClient(config, { api })
    await expect(client.get('/x')).rejects.toBeInstanceOf(PaymentRequiredError)
  })

  it('maps 400 invalid_input to ValidationError', async () => {
    const api = fakeApi(async () => {
      const err = new Error('Request failed')
      ;(err as any).response = { status: 400, data: { error: 'invalid_input' } }
      throw err
    })
    const client = createPaidClient(config, { api })
    await expect(client.get('/x')).rejects.toBeInstanceOf(ValidationError)
  })

  it('wraps network errors as UpstreamError', async () => {
    const api = fakeApi(async () => {
      throw new Error('ECONNRESET')
    })
    const client = createPaidClient(config, { api })
    await expect(client.get('/x')).rejects.toBeInstanceOf(UpstreamError)
  })
})