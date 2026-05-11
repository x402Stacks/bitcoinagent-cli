import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

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

type RequestRecord = {
  method: string
  url: string
}

type JsonValue = Record<string, unknown> | unknown[]

const requests: RequestRecord[] = []
let closeServer: (() => Promise<void>) | undefined

function writeJson(res: ServerResponse, statusCode: number, body: JsonValue, headers: Record<string, string> = {}) {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

function createPaymentRequiredHeader() {
  return Buffer.from(JSON.stringify({
    accepts: [
      {
        scheme: 'exact',
        network: 'stacks:2147483648',
        asset: 'STX',
        amount: '1000',
      },
    ],
  })).toString('base64')
}

async function startApiServer() {
  requests.length = 0

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    requests.push({ method: req.method ?? 'GET', url: `${url.pathname}${url.search}` })

    if (url.pathname === '/health') {
      writeJson(res, 200, { status: 'ok' })
      return
    }

    if (url.pathname === '/api/v1/services') {
      writeJson(res, 200, {
        data: {
          services: [
            { name: 'twitter', has_paid_endpoints: true },
            { name: 'tiktok', has_paid_endpoints: true },
          ],
        },
        meta: { provider: 'internal' },
      })
      return
    }

    if (url.pathname === '/api/v1/services/twitter/endpoints') {
      writeJson(res, 200, {
        data: {
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
                network: 'stacks:2147483648',
              },
            },
          ],
        },
        meta: { provider: 'internal' },
      })
      return
    }

    if (url.pathname === '/api/v1/tiktok/user/info') {
      writeJson(res, 200, {
        data: {
          statusCode: 0,
          status_code: 0,
          provider: 'fake',
          endpoint: '/api/user/info',
          query: {
            uniqueId: url.searchParams.get('uniqueId'),
          },
          data: {
            id: 'fake-tiktok-resource',
            uniqueId: 'fake_creator',
            title: 'Fake TikTok testnet payload',
          },
        },
        meta: { provider: 'fake' },
      })
      return
    }

    if (url.pathname === '/api/v1/tiktok/user/posts') {
      writeJson(res, 200, {
        data: {
          statusCode: 0,
          status_code: 0,
          provider: 'fake',
          endpoint: '/api/user/posts',
          query: {
            secUid: url.searchParams.get('secUid'),
            count: url.searchParams.get('count'),
          },
          data: {
            id: 'fake-tiktok-resource',
            uniqueId: 'fake_creator',
            title: 'Fake TikTok testnet payload',
          },
        },
        meta: { provider: 'fake' },
      })
      return
    }

    if (url.pathname === '/api/v1/twitter/highlights') {
      writeJson(res, 200, {
        data: [
          {
            ID: 'highlight-1',
            Text: 'highlight text',
            Likes: 20,
            Retweets: 3,
            Replies: 1,
            Views: 300,
            BookmarkCount: 2,
            CreatedAt: '2026-04-16T00:00:00Z',
          },
        ],
        meta: { provider: 'rapidapi' },
      })
      return
    }

    if (url.pathname === '/api/v1/twitter/tweets') {
      writeJson(res, 200, {
        data: [
          {
            ID: 'tweet-1',
            Text: 'hello world',
            Likes: 100,
            Retweets: 5,
            Replies: 2,
            Views: 1000,
            BookmarkCount: 1,
            CreatedAt: '2026-04-16T00:00:00Z',
          },
        ],
        meta: { provider: 'rapidapi' },
      })
      return
    }

    if (url.pathname === '/api/v1/twitter/followings') {
      writeJson(res, 200, {
        data: [
          {
            RestID: 'user-1',
            Username: 'followed_user',
            DisplayName: 'Followed User',
            Description: 'Bio text',
            Followers: 1000,
            Following: 200,
            TweetsCount: 500,
            Location: 'City',
            ProfileImageURL: 'https://example.com/profile.jpg',
            IsBlueVerified: false,
          },
        ],
        meta: { provider: 'rapidapi' },
      })
      return
    }

    if (url.pathname === '/api/v1/twitter/profile') {
      writeJson(
        res,
        402,
        { error: 'payment_required' },
        { 'payment-required': createPaymentRequiredHeader() },
      )
      return
    }

    if (url.pathname === '/api/v1/airbnb/stays/search') {
      writeJson(res, 200, {
        data: {
          stays: [
            { id: 'stay-1', name: 'Downtown Loft' },
          ],
        },
        meta: { provider: 'rapidapi' },
      })
      return
    }

    if (url.pathname === '/api/v1/google-flights/booking/url' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8')
      })
      req.on('end', () => {
        writeJson(res, 200, {
          data: {
            received: JSON.parse(body),
          },
          meta: { provider: 'rapidapi' },
        })
      })
      return
    }

    writeJson(res, 404, { error: 'not_found' })
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo
  closeServer = () => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  return `http://127.0.0.1:${address.port}`
}

async function execute(argv: string[]) {
  const stdout = createMemoryWriter()
  const stderr = createMemoryWriter()

  const exitCode = await runCli(argv, {
    stdout,
    stderr,
    now: () => '2026-04-16T00:00:00.000Z',
    env: {},
  })

  return {
    exitCode,
    stdout: stdout.read(),
    stderr: stderr.read(),
  }
}

afterEach(async () => {
  if (closeServer) {
    await closeServer()
    closeServer = undefined
  }
})

describe('api endpoint commands', () => {
  it('returns the health endpoint as structured json', async () => {
    const apiUrl = await startApiServer()
    const result = await execute(['health', '--api-url', apiUrl, '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(true)
    expect(payload.data.endpoint).toBe('/health')
    expect(payload.data.response).toEqual({ status: 'ok' })
    expect(payload.meta.mode).toBe('json')
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('lists services through the discovery endpoint', async () => {
    const apiUrl = await startApiServer()
    const result = await execute(['services', '--api-url', apiUrl, '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.success).toBe(true)
    expect(payload.data.provider).toBe('internal')
    expect(payload.data.response.services[0]).toEqual({
      name: 'twitter',
      has_paid_endpoints: true,
    })
  })

  it('lists endpoints for a service', async () => {
    const apiUrl = await startApiServer()
    const result = await execute(['service-endpoints', '--service', 'twitter', '--api-url', apiUrl, '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.endpoint).toBe('/api/v1/services/twitter/endpoints')
    expect(payload.data.response.service).toBe('twitter')
    expect(payload.data.response.endpoints[0].payment.amount).toBe('1000')
  })

  it('fetches TikTok user info by username through the testnet API23 route', async () => {
    const apiUrl = await startApiServer()
    const result = await execute(['tiktok-profile', '--username', 'creator_1', '--api-url', apiUrl, '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.provider).toBe('fake')
    expect(payload.data.response.endpoint).toBe('/api/user/info')
    expect(payload.data.response.query.uniqueId).toBe('creator_1')
    expect(requests.at(-1)?.url).toBe('/api/v1/tiktok/user/info?uniqueId=creator_1')
  })

  it('lists TikTok user posts by secUid through the testnet API23 route', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'tiktok-videos',
      '--sec-uid',
      'sec-user-1',
      '--count',
      '5',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.provider).toBe('fake')
    expect(payload.data.response.endpoint).toBe('/api/user/posts')
    expect(payload.data.response.query).toEqual({ secUid: 'sec-user-1', count: '5' })
    expect(requests.at(-1)?.url).toBe('/api/v1/tiktok/user/posts?secUid=sec-user-1&count=5')
  })

  it('fetches Twitter highlights with an optional count', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'twitter-highlights',
      '--user-id',
      '877807935493033984',
      '--count',
      '3',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.provider).toBe('rapidapi')
    expect(payload.data.response[0].ID).toBe('highlight-1')
    expect(requests.at(-1)?.url).toBe('/api/v1/twitter/highlights?user_id=877807935493033984&count=3')
  })

  it('fetches Twitter tweets with an optional count', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'twitter-tweets',
      '--user-id',
      '2455740283',
      '--count',
      '5',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.provider).toBe('rapidapi')
    expect(payload.data.response[0].ID).toBe('tweet-1')
    expect(requests.at(-1)?.url).toBe('/api/v1/twitter/tweets?user_id=2455740283&count=5')
  })

  it('fetches Twitter followings with an optional count', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'twitter-followings',
      '--user-id',
      '2455740283',
      '--count',
      '2',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.provider).toBe('rapidapi')
    expect(payload.data.response[0].Username).toBe('followed_user')
    expect(requests.at(-1)?.url).toBe('/api/v1/twitter/followings?user_id=2455740283&count=2')
  })

  it('returns decoded x402 payment challenges as structured errors', async () => {
    const apiUrl = await startApiServer()
    const result = await execute(['twitter-profile', '--username', 'MrBeast', '--api-url', apiUrl, '--json'])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('PAYMENT_REQUIRED')
    expect(payload.error.details.paymentRequired.accepts[0]).toEqual({
      scheme: 'exact',
      network: 'stacks:2147483648',
      asset: 'STX',
      amount: '1000',
    })
  })

  it('calls any GET endpoint by path with repeated query flags', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'api-call',
      '--method',
      'GET',
      '--path',
      '/api/v1/airbnb/stays/search',
      '--query',
      'placeId=ChIJVTPokywQkFQRmtVEaUZlJRA',
      '--query',
      'currency=USD',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.endpoint).toBe('/api/v1/airbnb/stays/search')
    expect(payload.data.provider).toBe('rapidapi')
    expect(payload.data.response.stays[0].id).toBe('stay-1')
    expect(requests.at(-1)?.method).toBe('GET')
    expect(requests.at(-1)?.url).toBe('/api/v1/airbnb/stays/search?placeId=ChIJVTPokywQkFQRmtVEaUZlJRA&currency=USD')
  })

  it('calls any POST endpoint by path with a JSON body', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'api-call',
      '--method',
      'POST',
      '--path',
      '/api/v1/google-flights/booking/url',
      '--body-json',
      '{"token":"booking-token"}',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.method).toBe('POST')
    expect(payload.data.endpoint).toBe('/api/v1/google-flights/booking/url')
    expect(payload.data.response.received).toEqual({ token: 'booking-token' })
    expect(requests.at(-1)?.method).toBe('POST')
  })

  it('rejects network-path references before calling api-call endpoints', async () => {
    const apiUrl = await startApiServer()
    const networkPath = `${apiUrl.replace(/^http:/, '')}/api/v1/services`
    const result = await execute([
      'api-call',
      '--path',
      networkPath,
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(requests).toHaveLength(0)
  })

  it('rejects dot-segment paths before calling api-call endpoints', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'api-call',
      '--path',
      '/api/v1/airbnb/../twitter/profile',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(requests).toHaveLength(0)
  })

  it('calls a service endpoint by service command and relative endpoint path', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'airbnb',
      '--endpoint',
      'stays/search',
      '--query',
      'placeId=ChIJVTPokywQkFQRmtVEaUZlJRA',
      '--query',
      'currency=USD',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.endpoint).toBe('/api/v1/airbnb/stays/search')
    expect(payload.data.provider).toBe('rapidapi')
    expect(payload.data.response.stays[0].id).toBe('stay-1')
    expect(requests.at(-1)?.method).toBe('GET')
    expect(requests.at(-1)?.url).toBe('/api/v1/airbnb/stays/search?placeId=ChIJVTPokywQkFQRmtVEaUZlJRA&currency=USD')
  })

  it('rejects dot-segment paths before calling service endpoints', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'airbnb',
      '--endpoint',
      '../twitter/profile',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(requests).toHaveLength(0)
  })

  it('calls a POST service endpoint by service command and JSON body', async () => {
    const apiUrl = await startApiServer()
    const result = await execute([
      'google-flights',
      '--endpoint',
      'booking/url',
      '--method',
      'POST',
      '--body-json',
      '{"token":"booking-token"}',
      '--api-url',
      apiUrl,
      '--json',
    ])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.data.method).toBe('POST')
    expect(payload.data.endpoint).toBe('/api/v1/google-flights/booking/url')
    expect(payload.data.response.received).toEqual({ token: 'booking-token' })
    expect(requests.at(-1)?.method).toBe('POST')
  })
})
