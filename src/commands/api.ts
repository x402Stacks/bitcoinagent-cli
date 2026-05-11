import { Command } from 'commander'
import { z } from 'zod'

import { readBitcoinAgentApiConfig, type BitcoinAgentApiConfig } from '../core/api-config.js'
import { normalizeError, ValidationError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import { renderApiEndpointResult, renderFriendlyError } from '../output/human.js'
import {
  callApiEndpoint,
  getHealth,
  getTikTokProfile,
  getTwitterProfile,
  listServiceEndpoints,
  listServices,
  listTikTokVideos,
  listTwitterFollowings,
  listTwitterHighlights,
  listTwitterTweets,
} from '../services/bitcoinagent-api.js'
import type { ApiQueryPair } from '../services/bitcoinagent-api.js'
import type { ApiEndpointResult } from '../types/commands.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const apiServiceNames = [
  'airbnb',
  'booking',
  'google-flights',
  'instagram',
  'tiktok',
  'twitch',
  'twitter',
  'zillow',
] as const

type ApiServiceName = typeof apiServiceNames[number]

const apiCommandSchema = z.object({
  json: z.boolean().optional(),
  plain: z.boolean().optional(),
  apiUrl: z.string().trim().url('API URL must be valid.').optional(),
})

const serviceEndpointSchema = apiCommandSchema.extend({
  service: z.string().trim().min(1, 'Service is required.').transform((value) => value.toLowerCase()),
})

const usernameSchema = apiCommandSchema.extend({
  username: z.string().trim().min(1, 'Username is required.'),
})

const tiktokVideosSchema = apiCommandSchema.extend({
  secUid: z.string().trim().min(1, 'secUid is required.'),
  count: z.preprocess((value) => {
    if (value === undefined) {
      return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }, z.number().int().positive('Count must be positive.').optional()),
  cursor: z.string().trim().min(1, 'Cursor is required.').optional(),
})

const userIdSchema = apiCommandSchema.extend({
  userId: z.string().trim().min(1, 'User ID is required.'),
  count: z.preprocess((value) => {
    if (value === undefined) {
      return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }, z.number().int().positive('Count must be positive.').optional()),
})

const apiCallSchema = apiCommandSchema.extend({
  method: z.preprocess((value) => {
    if (typeof value === 'string') {
      return value.toUpperCase()
    }

    return 'GET'
  }, z.enum(['GET', 'POST'])),
  path: z.string().trim().min(1, 'Path is required.').refine(
    (value) => value.startsWith('/'),
    'Path must start with /.',
  ),
  query: z.array(z.string()).optional(),
  bodyJson: z.string().optional(),
})

const serviceCallSchema = apiCommandSchema.extend({
  method: z.preprocess((value) => {
    if (typeof value === 'string') {
      return value.toUpperCase()
    }

    return 'GET'
  }, z.enum(['GET', 'POST'])),
  endpoint: z.string().trim().min(1, 'Endpoint is required.'),
  query: z.array(z.string()).optional(),
  bodyJson: z.string().optional(),
})

function getRawFlags(options: Record<string, unknown>) {
  return {
    json: options.json === true,
    plain: options.plain === true,
  }
}

function collectQuery(value: string, previous: string[] = []) {
  return [...previous, value]
}

function parseQueryPairs(values: string[] | undefined): ApiQueryPair[] | undefined {
  if (values === undefined || values.length === 0) {
    return undefined
  }

  return values.map((value) => {
    const separatorIndex = value.indexOf('=')

    if (separatorIndex <= 0) {
      throw new ValidationError(`Query values must use key=value format (got "${value}").`)
    }

    return {
      key: value.slice(0, separatorIndex),
      value: value.slice(separatorIndex + 1),
    }
  })
}

function parseBodyJson(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  try {
    JSON.parse(value)
  } catch {
    throw new ValidationError('Body JSON must be valid JSON.')
  }

  return value
}

function createApiCallRequest(
  method: ApiEndpointResult['method'],
  path: string,
  queryValues: string[] | undefined,
  bodyJsonValue: string | undefined,
) {
  const query = parseQueryPairs(queryValues)
  const bodyJson = parseBodyJson(bodyJsonValue)

  return {
    method,
    path,
    ...(query === undefined ? {} : { query }),
    ...(bodyJson === undefined ? {} : { bodyJson }),
  }
}

function normalizeServiceEndpointPath(service: ApiServiceName, endpoint: string) {
  if (endpoint.includes('?')) {
    throw new ValidationError('Endpoint must not include a query string. Use --query key=value instead.')
  }

  const withoutLeadingSlash = endpoint.replace(/^\/+/, '')
  const serviceRoot = `/api/v1/${service}`

  if (withoutLeadingSlash.startsWith('api/v1/')) {
    const fullPath = `/${withoutLeadingSlash}`

    if (!fullPath.startsWith(`${serviceRoot}/`)) {
      throw new ValidationError(`Endpoint must be under ${serviceRoot}/.`)
    }

    return fullPath
  }

  const relativePath = withoutLeadingSlash.startsWith(`${service}/`)
    ? withoutLeadingSlash.slice(service.length + 1)
    : withoutLeadingSlash

  if (relativePath === '') {
    throw new ValidationError('Endpoint path under the service is required.')
  }

  return `${serviceRoot}/${relativePath}`
}

async function handleApiCommand<T extends { apiUrl?: string | undefined }>(
  options: Record<string, unknown>,
  runtime: ResolvedRuntime,
  parseOptions: (options: Record<string, unknown>) => T,
  getResult: (
    parsed: T,
    config: BitcoinAgentApiConfig,
    timestamp: string,
  ) => Promise<ApiEndpointResult>,
): Promise<number> {
  const context = createCommandContext(getRawFlags(options), runtime)

  try {
    const parsed = parseOptions(options)
    const config = readBitcoinAgentApiConfig(context.env, parsed.apiUrl)
    const timestamp = context.now()
    const result = await getResult(parsed, config, timestamp)

    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }

    await renderApiEndpointResult(context, result)
    return 0
  } catch (error) {
    const normalized = normalizeError(error)

    if (context.mode === 'json') {
      renderJsonError(context, normalized, context.now())
    } else {
      renderFriendlyError(context, normalized)
    }

    return getExitCode(normalized)
  }
}

function withEndpointOptions(command: Command) {
  return command
    .option('--api-url <url>', 'Bitcoinagent API base URL (defaults to BITCOINAGENT_API_URL or http://localhost:8080)')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
}

export function registerApiCommands(program: Command, runtime: ResolvedRuntime) {
  withEndpointOptions(program.command('health').description('Call GET /health'))
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => apiCommandSchema.parse(value),
        (_parsed, config, timestamp) => getHealth(config, timestamp),
      )
    })

  withEndpointOptions(program.command('services').description('Call GET /api/v1/services'))
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => apiCommandSchema.parse(value),
        (_parsed, config, timestamp) => listServices(config, timestamp),
      )
    })

  withEndpointOptions(program.command('service-endpoints').description('Call GET /api/v1/services/:service/endpoints'))
    .requiredOption('--service <name>', 'Service name')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => serviceEndpointSchema.parse(value),
        (parsed, config, timestamp) => listServiceEndpoints(config, parsed.service, timestamp),
      )
    })

  withEndpointOptions(program.command('api-call').description('Call any bitcoinagent API endpoint by method and path'))
    .option('--method <method>', 'HTTP method: GET or POST', 'GET')
    .requiredOption('--path <path>', 'Endpoint path, for example /api/v1/airbnb/stays/search')
    .option('--query <key=value>', 'Query parameter; repeat for multiple values', collectQuery)
    .option('--body-json <json>', 'JSON request body for POST endpoints')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => apiCallSchema.parse(value),
        (parsed, config, timestamp) => callApiEndpoint(
          config,
          createApiCallRequest(parsed.method, parsed.path, parsed.query, parsed.bodyJson),
          timestamp,
        ),
      )
    })

  for (const service of apiServiceNames) {
    withEndpointOptions(program.command(service).description(`Call any ${service} API endpoint by relative path`))
      .option('--method <method>', 'HTTP method: GET or POST', 'GET')
      .requiredOption('--endpoint <path>', `Endpoint path under /api/v1/${service}`)
      .option('--query <key=value>', 'Query parameter; repeat for multiple values', collectQuery)
      .option('--body-json <json>', 'JSON request body for POST endpoints')
      .action(async (options: Record<string, unknown>) => {
        runtime.exitCode = await handleApiCommand(
          options,
          runtime,
          (value) => serviceCallSchema.parse(value),
          (parsed, config, timestamp) => callApiEndpoint(
            config,
            createApiCallRequest(
              parsed.method,
              normalizeServiceEndpointPath(service, parsed.endpoint),
              parsed.query,
              parsed.bodyJson,
            ),
            timestamp,
          ),
        )
      })
  }

  withEndpointOptions(program.command('tiktok-profile').description('Call GET /api/v1/tiktok/user/info'))
    .requiredOption('--username <username>', 'TikTok username')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => usernameSchema.parse(value),
        (parsed, config, timestamp) => getTikTokProfile(config, parsed.username, timestamp),
      )
    })

  withEndpointOptions(program.command('tiktok-videos').description('Call GET /api/v1/tiktok/user/posts'))
    .requiredOption('--sec-uid <secUid>', 'TikTok user secUid')
    .option('--count <number>', 'Number of posts to return')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => tiktokVideosSchema.parse(value),
        (parsed, config, timestamp) => listTikTokVideos(
          config,
          parsed.secUid,
          parsed.count,
          parsed.cursor,
          timestamp,
        ),
      )
    })

  withEndpointOptions(program.command('twitter-profile').description('Call GET /api/v1/twitter/profile'))
    .requiredOption('--username <username>', 'Twitter username')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => usernameSchema.parse(value),
        (parsed, config, timestamp) => getTwitterProfile(config, parsed.username, timestamp),
      )
    })

  withEndpointOptions(program.command('twitter-highlights').description('Call GET /api/v1/twitter/highlights'))
    .requiredOption('--user-id <id>', 'Twitter user REST ID')
    .option('--count <number>', 'Number of highlights to return')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => userIdSchema.parse(value),
        (parsed, config, timestamp) => listTwitterHighlights(config, parsed.userId, parsed.count, timestamp),
      )
    })

  withEndpointOptions(program.command('twitter-tweets').description('Call GET /api/v1/twitter/tweets'))
    .requiredOption('--user-id <id>', 'Twitter user REST ID')
    .option('--count <number>', 'Number of tweets to return')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => userIdSchema.parse(value),
        (parsed, config, timestamp) => listTwitterTweets(config, parsed.userId, parsed.count, timestamp),
      )
    })

  withEndpointOptions(program.command('twitter-followings').description('Call GET /api/v1/twitter/followings'))
    .requiredOption('--user-id <id>', 'Twitter user REST ID')
    .option('--count <number>', 'Number of following accounts to return')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleApiCommand(
        options,
        runtime,
        (value) => userIdSchema.parse(value),
        (parsed, config, timestamp) => listTwitterFollowings(config, parsed.userId, parsed.count, timestamp),
      )
    })
}
