import { ValidationError } from './errors.js'

export interface ApiConfig {
  baseURL: string
  timeoutMs: number
}

const DEFAULT_BASE_URL = 'http://localhost:3000'
const DEFAULT_TIMEOUT_MS = 60_000

export function readApiConfig(env: NodeJS.ProcessEnv): ApiConfig {
  const rawBase = env.API_BASE_URL?.trim()
  const baseURL = (rawBase && rawBase.length > 0 ? rawBase : DEFAULT_BASE_URL).replace(/\/+$/, '')

  const rawTimeout = env.API_TIMEOUT_MS?.trim()
  if (!rawTimeout) return { baseURL, timeoutMs: DEFAULT_TIMEOUT_MS }

  const timeoutMs = Number(rawTimeout)
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ValidationError(
      `API_TIMEOUT_MS must be a positive integer (got "${rawTimeout}").`,
    )
  }
  return { baseURL, timeoutMs }
}