import type { OutputMode } from './output.js'

export interface Writer {
  write(chunk: string | Uint8Array): boolean
  isTTY?: boolean
}

export interface RuntimeOptions {
  stdout?: Writer
  stderr?: Writer
  stdin?: NodeJS.ReadableStream
  now?: () => string
}

export interface TerminalInfo {
  stdinIsTTY: boolean
  stdoutIsTTY: boolean
  stderrIsTTY: boolean
  interactive: boolean
}

export interface CommandContext {
  mode: OutputMode
  nonInteractive: boolean
  stdout: Writer
  stderr: Writer
  terminal: TerminalInfo
  now: () => string
}
