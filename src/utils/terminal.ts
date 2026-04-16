import { Writable } from 'node:stream'

import { readEnvironment } from '../core/env.js'
import type { CommandContext, RuntimeOptions, TerminalInfo, Writer } from '../types/context.js'
import { resolveOutputMode } from './mode.js'

export function getTerminalInfo(
  stdin: NodeJS.ReadableStream = process.stdin,
  stdout: Pick<Writer, 'isTTY'> = process.stdout,
  stderr: Pick<Writer, 'isTTY'> = process.stderr,
): TerminalInfo {
  const environment = readEnvironment()
  const stdinIsTTY =
    typeof (stdin as { isTTY?: unknown }).isTTY === 'boolean'
      ? Boolean((stdin as { isTTY?: boolean }).isTTY)
      : false
  const stdoutIsTTY = Boolean(stdout.isTTY)
  const stderrIsTTY = Boolean(stderr.isTTY)

  return {
    stdinIsTTY,
    stdoutIsTTY,
    stderrIsTTY,
    interactive: stdinIsTTY && stdoutIsTTY && !environment.ci,
  }
}

export function createCommandContext(
  flags: { json?: boolean; plain?: boolean; nonInteractive?: boolean },
  runtime: Required<RuntimeOptions>,
): CommandContext {
  return {
    mode: resolveOutputMode(flags),
    nonInteractive: Boolean(flags.nonInteractive),
    stdout: runtime.stdout,
    stderr: runtime.stderr,
    terminal: getTerminalInfo(runtime.stdin, runtime.stdout, runtime.stderr),
    now: runtime.now,
  }
}

export function toNodeWritable(writer: Writer): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      writer.write(chunk)
      callback()
    },
  })
}
