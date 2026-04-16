import { Command } from 'commander'
import { z } from 'zod'

import { getExitCode } from '../core/exit.js'
import { normalizeError } from '../core/errors.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import { renderFriendlyError, renderStatusResult } from '../output/human.js'
import { getAgentTaskStatus } from '../services/agent-service.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const statusCommandSchema = z.object({
  id: z.string().trim().min(1, 'Task id is required.'),
  json: z.boolean().optional(),
  plain: z.boolean().optional(),
})

function getRawFlags(options: Record<string, unknown>) {
  return {
    json: options.json === true,
    plain: options.plain === true,
  }
}

async function handleStatus(options: Record<string, unknown>, runtime: ResolvedRuntime): Promise<number> {
  const context = createCommandContext(getRawFlags(options), runtime)

  try {
    const parsed = statusCommandSchema.parse(options)
    const timestamp = context.now()
    const result = getAgentTaskStatus(parsed.id, timestamp)

    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }

    await renderStatusResult(context, result)
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

export function registerStatusCommand(program: Command, runtime: ResolvedRuntime) {
  program
    .command('status')
    .description('Read fake status for a task')
    .requiredOption('--id <string>', 'Task identifier')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleStatus(options, runtime)
    })
}
