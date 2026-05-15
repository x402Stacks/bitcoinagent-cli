import type { OutputMode } from './output.js'

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: {
    env?: NodeJS.ProcessEnv
    cwd?: string
  },
) => Promise<{
  stdout: string
  stderr: string
}>

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export interface Writer {
  write(chunk: string | Uint8Array): boolean
  isTTY?: boolean
}

export interface RuntimeOptions {
  stdout?: Writer
  stderr?: Writer
  stdin?: NodeJS.ReadableStream
  now?: () => string
  env?: NodeJS.ProcessEnv
  commandRunner?: CommandRunner
  fetcher?: FetchLike
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
  env: NodeJS.ProcessEnv
}

export type ResolvedRuntime = Required<RuntimeOptions> & { exitCode: number }
