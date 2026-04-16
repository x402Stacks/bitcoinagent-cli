import { Command } from 'commander'
import { z } from 'zod'

import { getExitCode } from '../core/exit.js'
import { normalizeError } from '../core/errors.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import { renderFriendlyError, renderRunResult } from '../output/human.js'
import { runAgentTask } from '../services/agent-service.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const runCommandSchema = z.object({
  task: z.string().trim().min(1, 'Task is required.'),
  json: z.boolean().optional(),
  plain: z.boolean().optional(),
  nonInteractive: z.boolean().optional(),
})

function getRawFlags(options: Record<string, unknown>) {
  return {
    json: options.json === true,
    plain: options.plain === true,
    nonInteractive: options.nonInteractive === true,
  }
}

async function handleRun(options: Record<string, unknown>, runtime: ResolvedRuntime): Promise<number> {
  const context = createCommandContext(getRawFlags(options), runtime)

  try {
    const parsed = runCommandSchema.parse(options)
    const timestamp = context.now()
    const result = runAgentTask(parsed.task, timestamp)

    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }

    await renderRunResult(context, result)
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

export function registerRunCommand(program: Command, runtime: ResolvedRuntime) {
  program
    .command('run')
    .description('Run a fake agent task')
    .requiredOption('--task <string>', 'Task description')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .option('--non-interactive', 'Disable prompts for automation')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleRun(options, runtime)
    })
}
