import { Command } from 'commander'
import { z } from 'zod'

import { normalizeError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import {
  renderFriendlyError,
  renderTwitterFollowingsResult,
  renderTwitterProfileResult,
  renderTwitterTweetsResult,
} from '../output/human.js'
import {
  getTwitterProfile,
  listTwitterFollowings,
  listTwitterHighlights,
  listTwitterTweets,
} from '../services/twitter-service.js'
import { getPaidTransport } from '../services/transport.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const baseFlags = z.object({ json: z.boolean().optional(), plain: z.boolean().optional() })
const profileSchema = baseFlags.extend({ username: z.string().trim().min(1, 'Username is required.') })
const countSchema = z.coerce.number().int().positive().max(200).default(20)
const userIdCountSchema = baseFlags.extend({
  userId: z.string().trim().min(1, 'user_id is required.'),
  count: countSchema,
})

function rawFlags(o: Record<string, unknown>) {
  return { json: o.json === true, plain: o.plain === true }
}

async function handle<T>(
  runtime: ResolvedRuntime,
  opts: Record<string, unknown>,
  schema: z.ZodType<T>,
  exec: (parsed: T, ctx: ReturnType<typeof createCommandContext>, ts: string) => Promise<unknown>,
  render: (ctx: ReturnType<typeof createCommandContext>, result: any) => Promise<void>,
): Promise<number> {
  const context = createCommandContext(rawFlags(opts), runtime)
  try {
    const parsed = schema.parse(opts)
    const ts = context.now()
    const result = await exec(parsed, context, ts)
    if (context.mode === 'json') {
      renderJsonSuccess(context, result, ts)
      return 0
    }
    await render(context, result)
    return 0
  } catch (err) {
    const n = normalizeError(err)
    if (context.mode === 'json') renderJsonError(context, n, context.now())
    else renderFriendlyError(context, n)
    return getExitCode(n)
  }
}

export function registerTwitterCommand(program: Command, runtime: ResolvedRuntime) {
  const twitter = program
    .command('twitter')
    .description('Twitter endpoints (x402-paid; requires STACKS_PRIVATE_KEY when enabled)')

  twitter
    .command('profile')
    .description('Fetch a Twitter profile by username (paid)')
    .requiredOption('--username <string>', 'Twitter username')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await handle(
        runtime,
        opts,
        profileSchema,
        async (p, ctx, ts) => getTwitterProfile(getPaidTransport(ctx), p.username, ts),
        renderTwitterProfileResult,
      )
    })

  twitter
    .command('tweets')
    .description('List tweets for a user_id (paid)')
    .requiredOption('--user-id <string>', 'Twitter REST user ID')
    .option('--count <number>', 'Max results (default 20)', '20')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await handle(
        runtime,
        opts,
        userIdCountSchema,
        async (p, ctx, ts) => listTwitterTweets(getPaidTransport(ctx), p.userId, p.count, ts),
        (ctx, r) => renderTwitterTweetsResult(ctx, r, 'tweets'),
      )
    })

  twitter
    .command('highlights')
    .description('List highlights for a user_id (paid)')
    .requiredOption('--user-id <string>', 'Twitter REST user ID')
    .option('--count <number>', 'Max results (default 20)', '20')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await handle(
        runtime,
        opts,
        userIdCountSchema,
        async (p, ctx, ts) => listTwitterHighlights(getPaidTransport(ctx), p.userId, p.count, ts),
        (ctx, r) => renderTwitterTweetsResult(ctx, r, 'highlights'),
      )
    })

  twitter
    .command('followings')
    .description('List accounts a user_id follows (paid)')
    .requiredOption('--user-id <string>', 'Twitter REST user ID')
    .option('--count <number>', 'Max results (default 20)', '20')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await handle(
        runtime,
        opts,
        userIdCountSchema,
        async (p, ctx, ts) => listTwitterFollowings(getPaidTransport(ctx), p.userId, p.count, ts),
        renderTwitterFollowingsResult,
      )
    })
}