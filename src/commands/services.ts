import { Command } from 'commander'
import { z } from 'zod'

import { normalizeError } from '../core/errors.js'
import { getExitCode } from '../core/exit.js'
import { renderJsonError, renderJsonSuccess } from '../output/agent.js'
import {
  renderFriendlyError,
  renderServiceEndpointsResult,
  renderServicesListResult,
} from '../output/human.js'
import {
  listServices,
  getServiceEndpoints,
} from '../services/services-service.js'
import { getFreeTransport } from '../services/transport.js'
import type { ResolvedRuntime } from '../types/context.js'
import { createCommandContext } from '../utils/terminal.js'

const flagsSchema = z.object({ json: z.boolean().optional(), plain: z.boolean().optional() })

function getRawFlags(opts: Record<string, unknown>) {
  return { json: opts.json === true, plain: opts.plain === true }
}

async function handleList(opts: Record<string, unknown>, runtime: ResolvedRuntime): Promise<number> {
  const context = createCommandContext(getRawFlags(opts), runtime)
  try {
    flagsSchema.parse(opts)
    const client = getFreeTransport(context)
    const timestamp = context.now()
    const result = await listServices(client, timestamp)
    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }
    await renderServicesListResult(context, result)
    return 0
  } catch (err) {
    const n = normalizeError(err)
    if (context.mode === 'json') renderJsonError(context, n, context.now())
    else renderFriendlyError(context, n)
    return getExitCode(n)
  }
}

async function handleEndpoints(
  service: string,
  opts: Record<string, unknown>,
  runtime: ResolvedRuntime,
): Promise<number> {
  const context = createCommandContext(getRawFlags(opts), runtime)
  try {
    flagsSchema.parse(opts)
    const name = z
      .string()
      .trim()
      .min(1, 'Service name is required.')
      .parse(service)
    const client = getFreeTransport(context)
    const timestamp = context.now()
    const result = await getServiceEndpoints(client, name, timestamp)
    if (context.mode === 'json') {
      renderJsonSuccess(context, result, timestamp)
      return 0
    }
    await renderServiceEndpointsResult(context, result)
    return 0
  } catch (err) {
    const n = normalizeError(err)
    if (context.mode === 'json') renderJsonError(context, n, context.now())
    else renderFriendlyError(context, n)
    return getExitCode(n)
  }
}

export function registerServicesCommand(program: Command, runtime: ResolvedRuntime) {
  const services = program
    .command('services')
    .description('Discover available API services and their endpoints')

  services
    .command('list')
    .description('List all services and which have paid endpoints')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (opts: Record<string, unknown>) => {
      runtime.exitCode = await handleList(opts, runtime)
    })

  services
    .command('endpoints <service>')
    .description('List endpoints and payment metadata for a service')
    .option('--json', 'Emit structured JSON only')
    .option('--plain', 'Emit minimal readable text')
    .action(async (service: string, opts: Record<string, unknown>) => {
      runtime.exitCode = await handleEndpoints(service, opts, runtime)
    })
}