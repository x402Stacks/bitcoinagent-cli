import type { CliError } from '../core/errors.js'
import type { CommandContext } from '../types/context.js'
import type { CliResponse } from '../types/output.js'
import { writeJson } from '../utils/json.js'

export function createSuccessResponse<T>(
  data: T,
  mode: CommandContext['mode'],
  timestamp: string,
): CliResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp,
      mode,
    },
  }
}

export function createErrorResponse(
  error: CliError,
  mode: CommandContext['mode'],
  timestamp: string,
): CliResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    meta: {
      timestamp,
      mode,
    },
  }
}

export function renderJsonSuccess<T>(context: CommandContext, data: T, timestamp: string) {
  writeJson(context.stdout, createSuccessResponse(data, context.mode, timestamp))
}

export function renderJsonError(context: CommandContext, error: CliError, timestamp: string) {
  writeJson(context.stdout, createErrorResponse(error, context.mode, timestamp))
}
