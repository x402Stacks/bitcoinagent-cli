import { describe, expect, it } from 'vitest'
import { createFreeClient } from '../src/services/api-client.js'
import { NotFoundError, UpstreamError, ValidationError } from '../src/core/errors.js'

function makeFetch(response: { status: number; body: unknown }) {
  return async (input: string | URL) => ({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    url: String(input),
    json: async () => response.body,
  }) as unknown as Response
}

const config = { baseURL: 'https://api.test', timeoutMs: 1_000 }

describe('createFreeClient', () => {
  it('GETs path and returns unwrapped envelope', async () => {
    const fetch = makeFetch({
      status: 200,
      body: { data: { ok: true }, meta: { provider: 'mock' } },
    })
    const client = createFreeClient(config, { fetch })
    const res = await client.get<{ ok: boolean }>('/api/v1/services')
    expect(res).toEqual({ data: { ok: true }, provider: 'mock' })
  })

  it('appends truthy query params and skips undefined', async () => {
    let seen = ''
    const fetch = (async (input: string | URL) => {
      seen = String(input)
      return {
        ok: true,
        status: 200,
        url: seen,
        json: async () => ({ data: [], meta: { provider: 'mock' } }),
      } as unknown as Response
    })
    const client = createFreeClient(config, { fetch })
    await client.get('/api/v1/twitter/tweets', { user_id: '123', count: 5, empty: undefined })
    expect(seen).toBe('https://api.test/api/v1/twitter/tweets?user_id=123&count=5')
  })

  it('maps 404 not_found to NotFoundError', async () => {
    const fetch = makeFetch({ status: 404, body: { error: 'not_found' } })
    const client = createFreeClient(config, { fetch })
    await expect(client.get('/api/v1/services/unknown/endpoints')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('maps 400 invalid_input to ValidationError', async () => {
    const fetch = makeFetch({ status: 400, body: { error: 'invalid_input' } })
    const client = createFreeClient(config, { fetch })
    await expect(client.get('/x')).rejects.toBeInstanceOf(ValidationError)
  })

  it('wraps network errors as UpstreamError', async () => {
    const fetch = (async () => {
      throw new Error('ECONNREFUSED')
    })
    const client = createFreeClient(config, { fetch })
    await expect(client.get('/x')).rejects.toBeInstanceOf(UpstreamError)
  })
})