import { Command } from 'commander'
import { z } from 'zod'

import { normalizeError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import {
  renderFriendlyError,
  renderTiktokProfileResult,
  renderTiktokVideosResult,
} from '../output/human.js'
import { getTiktokProfile, listTiktokVideos } from '../services/tiktok-service.js'
import { getFreeTransport } from '../services/transport.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const flags = z.object({ json: z.boolean().optional(), plain: z.boolean().optional() })
const profileSchema = flags.extend({ username: z.string().trim().min(1, 'Username is required.') })
const videosSchema = profileSchema

function getRawFlags(o: Record<string, unknown>) {
  return { json: o.json === true, plain: o.plain === true }
}

async function runWith<T>(
  runtime: ResolvedRuntime,
  opts: Record<string, unknown>,
  schema: z.ZodType<T>,
  exec: (parsed: T, ctx: ReturnType<typeof createCommandContext>, ts: string) => Promise<unknown>,
  render: (ctx: ReturnType<typeof createCommandContext>, result: any) => Promise<void>,
): Promise<number> {
  const context = createCommandContext(getRawFlags(opts), runtime)
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

export function registerTiktokCommand(program: Command, runtime: ResolvedRuntime) {
  const tiktok = program.command('tiktok').description('TikTok endpoints (mock provider, free)')

  tiktok
    .command('profile')
    .description('Fetch a TikTok profile by username')
    .requiredOption('--username <string>', 'TikTok username')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await runWith(
        runtime,
        opts,
        profileSchema,
        async (p, ctx, ts) => getTiktokProfile(getFreeTransport(ctx), p.username, ts),
        renderTiktokProfileResult,
      )
    })

  tiktok
    .command('videos')
    .description('List TikTok videos for a username')
    .requiredOption('--username <string>', 'TikTok username')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await runWith(
        runtime,
        opts,
        videosSchema,
        async (p, ctx, ts) => listTiktokVideos(getFreeTransport(ctx), p.username, ts),
        renderTiktokVideosResult,
      )
    })
}