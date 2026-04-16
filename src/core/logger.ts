import type { Writer } from '../types/context.js'
import type { OutputMode } from '../types/output.js'

export type Logger = {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

function writeLine(writer: Writer, message: string) {
  writer.write(`${message}\n`)
}

export function createLogger(mode: OutputMode, stdout: Writer, stderr: Writer): Logger {
  if (mode === 'json') {
    return {
      info() {},
      warn() {},
      error() {},
    }
  }

  return {
    info(message) {
      writeLine(stdout, message)
    },
    warn(message) {
      writeLine(stderr, message)
    },
    error(message) {
      writeLine(stderr, message)
    },
  }
}
