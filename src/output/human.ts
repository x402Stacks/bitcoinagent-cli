import { log, note, spinner } from '@clack/prompts'

import type { CliError } from '../core/errors.js'
import { createLogger } from '../core/logger.js'
import type { CommandContext } from '../types/context.js'
import type {
  RunCommandResult,
  StatusCommandResult,
  WalletCommandResult,
} from '../types/commands.js'
import { toNodeWritable } from '../utils/terminal.js'

const HUMAN_BANNER = String.raw`
    _    ____ _____ _   _ _____
   / \  / ___| ____| \ | |_   _|
  / _ \| |  _|  _| |  \| | | |
 / ___ \ |_| | |___| |\  | | |
/_/   \_\____|_____|_| \_| |_|

agent-first command line
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

export async function renderRunResult(context: CommandContext, result: RunCommandResult) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `taskId: ${result.taskId}`,
      `task: ${result.task}`,
      `status: ${result.status}`,
      `summary: ${result.summary}`,
      `steps: ${result.steps.join(', ')}`,
      `timestamp: ${result.timestamp}`,
    ])
    return
  }

  renderBanner(context)

  const output = toNodeWritable(context.stdout)
  const status = spinner({ output })

  status.start('Running fake agent task')
  status.stop('Task complete')
  log.success(`Completed ${result.taskId}`, { output })
  note(
    [
      `Task: ${result.task}`,
      `Status: ${result.status}`,
      `Summary: ${result.summary}`,
      `Steps: ${result.steps.join(', ')}`,
      `Timestamp: ${result.timestamp}`,
    ].join('\n'),
    'Run Summary',
    { output },
  )
}

export async function renderStatusResult(context: CommandContext, result: StatusCommandResult) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `taskId: ${result.taskId}`,
      `status: ${result.status}`,
      `progress: ${result.progress}`,
      `summary: ${result.summary}`,
      `timestamp: ${result.timestamp}`,
    ])
    return
  }

  renderBanner(context)

  const output = toNodeWritable(context.stdout)
  const status = spinner({ output })

  status.start('Checking task status')
  status.stop('Status loaded')
  log.success(`Fetched ${result.taskId}`, { output })
  note(
    [
      `Status: ${result.status}`,
      `Progress: ${result.progress}%`,
      `Summary: ${result.summary}`,
      `Timestamp: ${result.timestamp}`,
    ].join('\n'),
    'Status Summary',
    { output },
  )
}

export async function renderWalletResult(context: CommandContext, result: WalletCommandResult) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `address: ${result.address}`,
      `network: ${result.network}`,
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
      `Timestamp: ${result.timestamp}`,
    ].join('\n'),
    'Wallet',
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
