import { log, note, spinner } from '@clack/prompts'

import type { CliError } from '../core/errors.js'
import { createLogger } from '../core/logger.js'
import type { CommandContext } from '../types/context.js'
import type {
  RunCommandResult,
  ServiceEndpointsResult,
  ServicesListResult,
  StatusCommandResult,
  TiktokProfileResult,
  TiktokVideosResult,
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

export async function renderServicesListResult(
  context: CommandContext,
  result: ServicesListResult,
) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `provider: ${result.provider}`,
      `timestamp: ${result.timestamp}`,
      ...result.services.map(
        (s) => `service: ${s.name} paid=${s.has_paid_endpoints}`,
      ),
    ])
    return
  }

  renderBanner(context)
  const output = toNodeWritable(context.stdout)
  log.success(`Discovered ${result.services.length} services`, { output })
  note(
    result.services
      .map((s) => `${s.name}${s.has_paid_endpoints ? '  (paid)' : '  (free)'}`)
      .join('\n'),
    'Services',
    { output },
  )
}

export async function renderServiceEndpointsResult(
  context: CommandContext,
  result: ServiceEndpointsResult,
) {
  if (context.mode === 'plain') {
    const lines = [`service: ${result.service}`, `provider: ${result.provider}`, `timestamp: ${result.timestamp}`]
    for (const ep of result.endpoints) {
      lines.push(`endpoint: ${ep.method} ${ep.path}`)
      if (ep.payment) {
        lines.push(
          `  payment: enabled=${ep.payment.enabled} required=${ep.payment.required} asset=${ep.payment.asset} amount=${ep.payment.amount} network=${ep.payment.network}`,
        )
      }
    }
    renderPlainBlock(context, lines)
    return
  }

  renderBanner(context)
  const output = toNodeWritable(context.stdout)
  log.success(`Endpoints for ${result.service}`, { output })
  for (const ep of result.endpoints) {
    const payment = ep.payment
      ? `\nPayment: ${ep.payment.enabled ? 'enabled' : 'advertised'} — ${ep.payment.amount} ${ep.payment.asset} on ${ep.payment.network}`
      : ''
    note(`${ep.method} ${ep.path}\n${ep.description}${payment}`, ep.path, { output })
  }
}

export async function renderTiktokProfileResult(
  context: CommandContext,
  result: TiktokProfileResult,
) {
  if (context.mode === 'plain') {
    renderPlainBlock(context, [
      `username: ${result.Username}`,
      `displayName: ${result.DisplayName}`,
      `followers: ${result.Followers}`,
      `provider: ${result.provider}`,
      `timestamp: ${result.timestamp}`,
    ])
    return
  }
  renderBanner(context)
  const output = toNodeWritable(context.stdout)
  log.success(`TikTok profile ${result.Username}`, { output })
  note(
    [
      `Display name: ${result.DisplayName}`,
      `Followers: ${result.Followers}`,
      `Provider: ${result.provider}`,
      `Timestamp: ${result.timestamp}`,
    ].join('\n'),
    'TikTok profile',
    { output },
  )
}

export async function renderTiktokVideosResult(
  context: CommandContext,
  result: TiktokVideosResult,
) {
  if (context.mode === 'plain') {
    const lines = [
      `username: ${result.username}`,
      `provider: ${result.provider}`,
      `timestamp: ${result.timestamp}`,
    ]
    for (const v of result.videos) lines.push(`video: ${v.ID} views=${v.Views} title="${v.Title}"`)
    renderPlainBlock(context, lines)
    return
  }
  renderBanner(context)
  const output = toNodeWritable(context.stdout)
  log.success(`${result.videos.length} videos for ${result.username}`, { output })
  for (const v of result.videos) note(`${v.Title}\nViews: ${v.Views}`, v.ID, { output })
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
