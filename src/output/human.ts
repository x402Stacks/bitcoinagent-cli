import { log, note } from '@clack/prompts'

import type { CliError } from '../core/errors.js'
import { createLogger } from '../core/logger.js'
import type { CommandContext } from '../types/context.js'
import type {
  ApiEndpointResult,
  WalletCommandResult,
} from '../types/commands.js'
import { toNodeWritable } from '../utils/terminal.js'

const HUMAN_BANNER = String.raw`
    _                    _   ____        _
   / \   __ _  ___ _ __ | |_/ ___|  __ _| |_ ___
  / _ \ / _ | / _ \ '_ \| __\___ \ / _ | | __/ __|
 / ___ \ (_| |  __/ | | | |_ ___) | (_| | | |_\__ \
/_/   \_\__, |\___|_| |_|\__|____/ \__,_|  \__|___/
        |___/

AgentSats command line
`

function formatDetails(details: unknown): string {
  if (details === undefined) {
    return ''
  }

  if (typeof details === 'string') {
    return details
  }

  return JSON.stringify(details, null, 2)
}

function renderPlainBlock(context: CommandContext, lines: string[]) {
  const logger = createLogger(context.mode, context.stdout, context.stderr)

  for (const line of lines) {
    logger.info(line)
  }
}

function renderBanner(context: CommandContext) {
  const output = toNodeWritable(context.stdout)
  output.write(`${HUMAN_BANNER}\n`)
}

export async function renderWalletResult(context: CommandContext, result: WalletCommandResult) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `address: ${result.address}`,
      `network: ${result.network}`,
      `provider: ${result.provider}`,
      `timestamp: ${result.timestamp}`,
    ])
    return
  }

  renderBanner(context)

  const output = toNodeWritable(context.stdout)

  log.success(`Wallet ready on ${result.network}`, { output })
  note(
    [
      `Address: ${result.address}`,
      `Network: ${result.network}`,
      `Provider: ${result.provider}`,
      `Timestamp: ${result.timestamp}`,
    ].join('\n'),
    'Wallet',
    { output },
  )
}

function formatResponse(value: unknown, pretty = false): string {
  return JSON.stringify(value, null, pretty ? 2 : 0)
}

export async function renderApiEndpointResult(context: CommandContext, result: ApiEndpointResult) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `endpoint: ${result.method} ${result.endpoint}`,
      `statusCode: ${result.statusCode}`,
      ...(result.provider === undefined ? [] : [`provider: ${result.provider}`]),
      `url: ${result.url}`,
      `response: ${formatResponse(result.response)}`,
      `timestamp: ${result.timestamp}`,
    ])
    return
  }

  renderBanner(context)

  const output = toNodeWritable(context.stdout)

  log.success(`Fetched ${result.method} ${result.endpoint}`, { output })
  note(
    [
      `Status: ${result.statusCode}`,
      ...(result.provider === undefined ? [] : [`Provider: ${result.provider}`]),
      `URL: ${result.url}`,
      `Response: ${formatResponse(result.response, true)}`,
      `Timestamp: ${result.timestamp}`,
    ].join('\n'),
    'API Response',
    { output },
  )
}

export function renderFriendlyError(context: CommandContext, error: CliError) {
  if (context.mode === 'plain') {
    const logger = createLogger(context.mode, context.stdout, context.stderr)
    logger.error(`${error.code}: ${error.message}`)

    if (error.details !== undefined) {
      logger.error(formatDetails(error.details))
    }

    return
  }

  const output = toNodeWritable(context.stderr)

  log.error(error.message, { output })

  if (error.details !== undefined) {
    note(formatDetails(error.details), 'Details', { output })
  }
}
