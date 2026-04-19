import { UpstreamError } from '../core/errors.js'
import type { ApiConfig } from '../core/api-config.js'
import { mapApiError, unwrapEnvelope } from './api-envelope.js'

export interface ApiClient {
  get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<{ data: T; provider: string }>
  getRaw<T>(path: string): Promise<T>
}

export interface ApiClientDeps {
  fetch?: typeof globalThis.fetch
}

export function createFreeClient(config: ApiConfig, deps: ApiClientDeps = {}): ApiClient {
  const doFetch = deps.fetch ?? globalThis.fetch

  async function get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<{ data: T; provider: string }> {
    const url = buildUrl(config.baseURL, path, params)
    let response: Response
    try {
      response = await doFetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: { accept: 'application/json' },
      })
    } catch (err) {
      throw new UpstreamError('Network request failed.', {
        endpoint: `GET ${path}`,
        cause: err instanceof Error ? err.message : String(err),
      })
    }

    const json = await response.json().catch(() => undefined)

    if (!response.ok) {
      const apiErrorCode =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: unknown }).error)
          : undefined
      throw mapApiError(response.status, apiErrorCode, `GET ${path}`)
    }

    return unwrapEnvelope<T>(json)
  }

  async function getRaw<T>(path: string): Promise<T> {
    const url = buildUrl(config.baseURL, path)
    let response: Response
    try {
      response = await doFetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: { accept: 'application/json' },
      })
    } catch (err) {
      throw new UpstreamError('Network request failed.', {
        endpoint: `GET ${path}`,
        cause: err instanceof Error ? err.message : String(err),
      })
    }

    const json = await response.json().catch(() => undefined)

    if (!response.ok) {
      const apiErrorCode =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: unknown }).error)
          : undefined
      throw mapApiError(response.status, apiErrorCode, `GET ${path}`)
    }

    return json as T
  }

  return { get, getRaw }
}

function buildUrl(
  baseURL: string,
  path: string,
  params?: Record<string, string | number | undefined>,
): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseURL)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}