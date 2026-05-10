import { InternalError, NotFoundError, PaymentRequiredError, ValidationError } from '../core/errors.js'
import type { BitcoinAgentApiConfig } from '../core/api-config.js'
import type { ApiEndpointResult } from '../types/commands.js'

type ApiEnvelope = {
  data: unknown
  meta?: {
    provider?: unknown
  }
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>
type ApiMethod = ApiEndpointResult['method']

export type ApiQueryPair = {
  key: string
  value: string
}

export interface ApiCallRequest {
  method: ApiMethod
  path: string
  query?: ApiQueryPair[]
  bodyJson?: string
}

function appendQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  const encoded = params.toString()
  return encoded ? `${path}?${encoded}` : path
}

function appendQueryPairs(path: string, query: readonly ApiQueryPair[] = []) {
  const params = new URLSearchParams()

  for (const pair of query) {
    params.append(pair.key, pair.value)
  }

  const encoded = params.toString()
  return encoded ? `${path}?${encoded}` : path
}

function getRawPathname(value: string) {
  // URL.pathname normalizes dot segments before validation; keep the raw path here.
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const endIndexes = [queryIndex, hashIndex].filter((index) => index >= 0)
  const endIndex = endIndexes.length === 0 ? value.length : Math.min(...endIndexes)

  return value.slice(0, endIndex)
}

function validateEndpointPath(path: string) {
  if (!path.startsWith('/')) {
    throw new ValidationError('Endpoint path must start with /.')
  }

  if (path.startsWith('//')) {
    throw new ValidationError('Endpoint path must not be a network-path reference.')
  }

  const pathname = getRawPathname(path)

  if (pathname.includes('\\')) {
    throw new ValidationError('Endpoint path must use forward slashes.')
  }

  for (const segment of pathname.split('/')) {
    let decodedSegment: string

    try {
      decodedSegment = decodeURIComponent(segment)
    } catch {
      throw new ValidationError('Endpoint path contains invalid percent encoding.')
    }

    if (decodedSegment === '.' || decodedSegment === '..') {
      throw new ValidationError('Endpoint path must not contain dot segments.')
    }
  }
}

function buildUrl(baseUrl: string, path: string) {
  validateEndpointPath(path)

  const base = new URL(baseUrl)
  const url = new URL(path, base)

  if (url.origin !== base.origin) {
    throw new ValidationError('Endpoint path must stay within the configured API base URL.')
  }

  return url.toString()
}

function tryParseJson(text: string): unknown {
  if (text.trim() === '') {
    return undefined
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new InternalError('Bitcoinagent API returned invalid JSON.', { body: text })
  }
}

function extractErrorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined
  }

  const error = (body as { error?: unknown }).error
  return typeof error === 'string' ? error : undefined
}

function decodeBase64Json(value: string | null): unknown {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
  } catch {
    return undefined
  }
}

function decodePaymentResponse(headers: Headers): unknown {
  return decodeBase64Json(headers.get('x-payment-response'))
}

function decodePaymentRequired(headers: Headers): unknown {
  return decodeBase64Json(headers.get('payment-required'))
}

function unwrapEnvelope(body: unknown): { provider?: string; response: unknown } {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    return { response: body }
  }

  const envelope = body as ApiEnvelope
  const provider = typeof envelope.meta?.provider === 'string' ? envelope.meta.provider : undefined

  return {
    response: envelope.data,
    ...(provider === undefined ? {} : { provider }),
  }
}

function toErrorDetails(
  statusCode: number,
  endpoint: string,
  url: string,
  body: unknown,
  paymentRequired?: unknown,
) {
  return {
    statusCode,
    endpoint,
    url,
    error: extractErrorCode(body),
    ...(paymentRequired === undefined ? {} : { paymentRequired }),
  }
}

async function requestEndpoint(
  config: BitcoinAgentApiConfig,
  method: ApiMethod,
  endpoint: string,
  path: string,
  timestamp: string,
  bodyJson?: string,
  fetcher: FetchLike = fetch,
): Promise<ApiEndpointResult> {
  const url = buildUrl(config.baseUrl, path)
  let response: Response

  try {
    response = await fetcher(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(bodyJson === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(bodyJson === undefined ? {} : { body: bodyJson }),
    })
  } catch (error) {
    throw new InternalError('Failed to call bitcoinagent API.', {
      endpoint,
      url,
      cause: error instanceof Error ? error.message : error,
    })
  }

  const body = tryParseJson(await response.text())

  if (response.ok) {
    const envelope = unwrapEnvelope(body)
    const paymentResponse = decodePaymentResponse(response.headers)

    return {
      method,
      endpoint,
      url,
      statusCode: response.status,
      ...(envelope.provider === undefined ? {} : { provider: envelope.provider }),
      response: envelope.response,
      ...(paymentResponse === undefined ? {} : { paymentResponse }),
      timestamp,
    }
  }

  const paymentRequired = decodePaymentRequired(response.headers)
  const details = toErrorDetails(response.status, endpoint, url, body, paymentRequired)

  if (response.status === 402) {
    throw new PaymentRequiredError('Payment is required for this endpoint.', details)
  }

  if (response.status === 400 || extractErrorCode(body) === 'invalid_input') {
    throw new ValidationError('Bitcoinagent API rejected the request as invalid.', details)
  }

  if (response.status === 404 || extractErrorCode(body) === 'not_found') {
    throw new NotFoundError('Bitcoinagent API resource was not found.', details)
  }

  throw new InternalError('Bitcoinagent API request failed.', details)
}

export function getHealth(config: BitcoinAgentApiConfig, timestamp: string) {
  return requestEndpoint(config, 'GET', '/health', '/health', timestamp)
}

export function listServices(config: BitcoinAgentApiConfig, timestamp: string) {
  return requestEndpoint(config, 'GET', '/api/v1/services', '/api/v1/services', timestamp)
}

export function listServiceEndpoints(
  config: BitcoinAgentApiConfig,
  service: string,
  timestamp: string,
) {
  const endpoint = `/api/v1/services/${service}/endpoints`
  return requestEndpoint(config, 'GET', endpoint, endpoint, timestamp)
}

export function getTikTokProfile(
  config: BitcoinAgentApiConfig,
  username: string,
  timestamp: string,
) {
  const endpoint = '/api/v1/tiktok/profile'
  return requestEndpoint(config, 'GET', endpoint, appendQuery(endpoint, { username }), timestamp)
}

export function listTikTokVideos(
  config: BitcoinAgentApiConfig,
  username: string,
  timestamp: string,
) {
  const endpoint = '/api/v1/tiktok/videos'
  return requestEndpoint(config, 'GET', endpoint, appendQuery(endpoint, { username }), timestamp)
}

export function getTwitterProfile(
  config: BitcoinAgentApiConfig,
  username: string,
  timestamp: string,
) {
  const endpoint = '/api/v1/twitter/profile'
  return requestEndpoint(config, 'GET', endpoint, appendQuery(endpoint, { username }), timestamp)
}

export function listTwitterHighlights(
  config: BitcoinAgentApiConfig,
  userId: string,
  count: number | undefined,
  timestamp: string,
) {
  const endpoint = '/api/v1/twitter/highlights'
  return requestEndpoint(config, 'GET', endpoint, appendQuery(endpoint, { user_id: userId, count }), timestamp)
}

export function listTwitterTweets(
  config: BitcoinAgentApiConfig,
  userId: string,
  count: number | undefined,
  timestamp: string,
) {
  const endpoint = '/api/v1/twitter/tweets'
  return requestEndpoint(config, 'GET', endpoint, appendQuery(endpoint, { user_id: userId, count }), timestamp)
}

export function listTwitterFollowings(
  config: BitcoinAgentApiConfig,
  userId: string,
  count: number | undefined,
  timestamp: string,
) {
  const endpoint = '/api/v1/twitter/followings'
  return requestEndpoint(config, 'GET', endpoint, appendQuery(endpoint, { user_id: userId, count }), timestamp)
}

export function callApiEndpoint(
  config: BitcoinAgentApiConfig,
  request: ApiCallRequest,
  timestamp: string,
) {
  return requestEndpoint(
    config,
    request.method,
    request.path,
    appendQueryPairs(request.path, request.query),
    timestamp,
    request.bodyJson,
  )
}
