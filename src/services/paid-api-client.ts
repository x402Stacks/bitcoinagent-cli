import { UpstreamError } from '../core/errors.js'
import type { ApiConfig } from '../core/api-config.js'
import type { StacksConfig } from '../core/stacks-config.js'
import { mapApiError, unwrapEnvelope } from './api-envelope.js'
import { createStacksClient } from './stacks-client.js'
import type { ApiClient } from './api-client.js'

interface AxiosLikeResponse<T = unknown> {
  status: number
  data: T
}

interface AxiosLike {
  get: (path: string, opts?: { params?: Record<string, unknown> }) => Promise<AxiosLikeResponse>
}

export interface PaidClientDeps {
  api?: AxiosLike
  stacks?: StacksConfig
}

export function createPaidClient(config: ApiConfig, deps: PaidClientDeps = {}): ApiClient {
  const api: AxiosLike =
    deps.api ??
    (createStacksClient(
      requireStacks(deps.stacks),
      { baseURL: config.baseURL, timeout: config.timeoutMs },
    ).api as unknown as AxiosLike)

  async function get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<{ data: T; provider: string }> {
    try {
      const cleaned = cleanParams(params)
      const response = cleaned
        ? await api.get(path, { params: cleaned })
        : await api.get(path)
      return unwrapEnvelope<T>(response.data)
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { error?: string } } }).response
      if (response && typeof response.status === 'number') {
        throw mapApiError(response.status, response.data?.error, `GET ${path}`)
      }
      throw new UpstreamError('Network request failed.', {
        endpoint: `GET ${path}`,
        cause: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function getRaw<T>(path: string): Promise<T> {
    try {
      const response = await api.get(path)
      return response.data as T
    } catch (err) {
      const errResponse = (err as { response?: { status?: number; data?: { error?: string } } }).response
      if (errResponse && typeof errResponse.status === 'number') {
        throw mapApiError(errResponse.status, errResponse.data?.error, `GET ${path}`)
      }
      throw new UpstreamError('Network request failed.', {
        endpoint: `GET ${path}`,
        cause: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { get, getRaw }
}

function requireStacks(stacks?: StacksConfig): StacksConfig {
  if (!stacks) {
    throw new Error('paid-api-client: STACKS config required when api is not injected')
  }
  return stacks
}

function cleanParams(
  params?: Record<string, string | number | undefined>,
): Record<string, string | number> | undefined {
  if (!params) return undefined
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') out[k] = v
  }
  return out
}