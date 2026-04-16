import { InternalError } from '../core/errors.js'
import type { Writer } from '../types/context.js'

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch (error) {
    throw new InternalError('Failed to serialize JSON output.', {
      cause: error instanceof Error ? error.message : error,
    })
  }
}

export function writeJson(writer: Writer, value: unknown) {
  writer.write(`${safeJsonStringify(value)}\n`)
}
