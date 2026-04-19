import { readApiConfig } from '../core/api-config.js'
import { readStacksConfig } from '../core/stacks-config.js'
import type { ApiClient } from './api-client.js'
import { createFreeClient } from './api-client.js'
import { createPaidClient } from './paid-api-client.js'

interface TransportCtx {
  env: NodeJS.ProcessEnv
}

export function getFreeTransport(ctx: TransportCtx): ApiClient {
  return createFreeClient(readApiConfig(ctx.env))
}

export function getPaidTransport(ctx: TransportCtx): ApiClient {
  const apiConfig = readApiConfig(ctx.env)
  const stacksConfig = readStacksConfig(ctx.env)
  return createPaidClient(apiConfig, { stacks: stacksConfig })
}