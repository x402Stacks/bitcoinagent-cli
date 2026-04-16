import {
  createPaymentClient,
  privateKeyToAccount,
  type StacksAccount,
} from 'x402-stacks'

import type { StacksConfig } from '../core/stacks-config.js'

export type StacksApi = ReturnType<typeof createPaymentClient>

export interface StacksClient {
  account: StacksAccount
  api: StacksApi
}

export interface StacksClientOptions {
  baseURL?: string
  timeout?: number
}

export function createStacksClient(
  config: StacksConfig,
  options: StacksClientOptions = {},
): StacksClient {
  const account = privateKeyToAccount(config.privateKey, config.network)
  const api = createPaymentClient(account, {
    baseURL: options.baseURL,
    timeout: options.timeout ?? 60_000,
  })

  return { account, api }
}
