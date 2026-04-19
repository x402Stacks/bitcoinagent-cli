import { Command } from 'commander'
import { z } from 'zod'

import { normalizeError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import { renderFriendlyError, renderHealthResult } from '../output/human.js'
import { getHealth } from '../services/health-service.js'
import { getFreeTransport } from '../services/transport.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const flagsSchema = z.object({ json: z.boolean().optional(), plain: z.boolean().optional() })

function getRawFlags(opts: Record<string, unknown>) {
  return { json: opts.json === true, plain: opts.plain === true }
}

async function handleHealth(opts: Record<string, unknown>, runtime: ResolvedRuntime): Promise<number> {
  const context = createCommandContext(getRawFlags(opts), runtime)
  try {
    flagsSchema.parse(opts)
    const client = getFreeTransport(context)
    const timestamp = context.now()
    const { status } = await getHealth(client)
    const result = { status, timestamp, provider: 'internal' }
    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }
    await renderHealthResult(context, result)
    return 0
  } catch (err) {
    const n = normalizeError(err)
    if (context.mode === 'json') renderJsonError(context, n, context.now())
    else renderFriendlyError(context, n)
    return getExitCode(n)
  }
}

export function registerHealthCommand(program: Command, runtime: ResolvedRuntime) {
  program
    .command('health')
    .description('Check the health of the API server')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await handleHealth(opts, runtime)
    })
}