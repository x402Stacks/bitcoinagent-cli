import { Command } from 'commander'
import { z } from 'zod'

import { normalizeError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { readStacksConfig } from '../core/stacks-config.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import { renderFriendlyError, renderWalletResult } from '../output/human.js'
import { getWalletInfo } from '../services/wallet-service.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const walletCommandSchema = z.object({
  json: z.boolean().optional(),
  plain: z.boolean().optional(),
})

function getRawFlags(options: Record<string, unknown>) {
  return {
    json: options.json === true,
    plain: options.plain === true,
  }
}

async function handleWallet(
  options: Record<string, unknown>,
  runtime: ResolvedRuntime,
): Promise<number> {
  const context = createCommandContext(getRawFlags(options), runtime)

  try {
    walletCommandSchema.parse(options)
    const config = readStacksConfig(context.env)
    const timestamp = context.now()
    const result = getWalletInfo(config, timestamp)

    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }

    await renderWalletResult(context, result)
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

export function registerWalletCommand(program: Command, runtime: ResolvedRuntime) {
  program
    .command('wallet')
    .description('Show the Stacks wallet derived from STACKS_PRIVATE_KEY')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (options: Record<string, unknown>) => {
      runtime.exitCode = await handleWallet(options, runtime)
    })
}
