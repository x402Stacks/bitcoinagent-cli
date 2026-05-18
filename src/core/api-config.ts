import { ValidationError } from './errors.js'

export interface BitcoinAgentApiConfig {
  baseUrl: string
}

const DEFAULT_BITCOINAGENT_API_URL = 'https://agentsats.stacksx402.com/'

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value)
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new ValidationError(`Invalid bitcoinagent API URL: ${value}`)
  }
}

export function readBitcoinAgentApiConfig(
  env: NodeJS.ProcessEnv,
  explicitBaseUrl?: string,
): BitcoinAgentApiConfig {
  const rawBaseUrl = explicitBaseUrl?.trim() || env.BITCOINAGENT_API_URL?.trim() || DEFAULT_BITCOINAGENT_API_URL

  return {
    baseUrl: normalizeBaseUrl(rawBaseUrl),
  }
}
