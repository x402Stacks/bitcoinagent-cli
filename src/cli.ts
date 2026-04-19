import { Command, CommanderError } from 'commander'

import { registerRunCommand } from './commands/run.js'
import { registerStatusCommand } from './commands/status.js'
import { registerWalletCommand } from './commands/wallet.js'
import { registerServicesCommand } from './commands/services.js'
import { registerTiktokCommand } from './commands/tiktok.js'
import { registerTwitterCommand } from './commands/twitter.js'
import { registerCompletionSupport } from './completions/tab.js'
import { ValidationError } from './core/errors.js'
import { getExitCode } from './core/exit.js'
import { normalizeError } from './core/errors.js'
import { renderJsonError } from './output/agent.js'
import { renderFriendlyError } from './output/human.js'
import type { ResolvedRuntime, RuntimeOptions, Writer } from './types/context.js'
import { createCommandContext } from './utils/terminal.js'

function resolveRuntime(options: RuntimeOptions = {}): ResolvedRuntime {
  return {
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
    stdin: options.stdin ?? process.stdin,
    now: options.now ?? (() => new Date().toISOString()),
    env: options.env ?? process.env,
    exitCode: 0,
  }
}

function isWriter(value: unknown): value is Writer {
  return typeof value === 'object' && value !== null && 'write' in value
}

function createProgram(runtime: ResolvedRuntime) {
  const program = new Command()

  program
    .name('agent-cli')
    .description('Agent-first CLI starter with explicit output modes')
    .version('0.1.0')
    .exitOverride()
    .configureOutput({
      writeOut: (chunk) => {
        runtime.stdout.write(chunk)
      },
      writeErr: () => {},
    })

  registerRunCommand(program, runtime)
  registerStatusCommand(program, runtime)
  registerWalletCommand(program, runtime)
  registerServicesCommand(program, runtime)
  registerTiktokCommand(program, runtime)
  registerTwitterCommand(program, runtime)
  registerCompletionSupport(program)

  return program
}

export function createCli(options: RuntimeOptions = {}) {
  return createProgram(resolveRuntime(options))
}

function isSuccessfulHelpExit(error: unknown): error is CommanderError {
  return (
    error instanceof CommanderError &&
    error.exitCode === 0 &&
    (error.code === 'commander.helpDisplayed' || error.code === 'commander.help')
  )
}

function isHelpRequest(argv: string[]) {
  return argv.includes('--help') || argv.includes('-h') || argv[0] === 'help'
}

export async function runCli(argv: string[], options: RuntimeOptions = {}) {
  const runtime = resolveRuntime(options)
  const flags = {
    json: argv.includes('--json'),
    plain: argv.includes('--plain'),
  }
  const context = createCommandContext(flags, runtime)

  if (context.mode === 'json' && isHelpRequest(argv)) {
    const error = new ValidationError('Help output is not available with --json. Use --plain or omit --json.')

    renderJsonError(context, error, context.now())
    return getExitCode(error)
  }

  const program = createProgram(runtime)

  try {
    await program.parseAsync(['node', 'agent-cli', ...argv], { from: 'node' })
    return runtime.exitCode
  } catch (error) {
    if (isSuccessfulHelpExit(error)) {
      return 0
    }

    const normalized = normalizeError(error)

    if (context.mode === 'json') {
      renderJsonError(context, normalized, context.now())
    } else {
      renderFriendlyError(context, normalized)
    }

    return getExitCode(normalized)
  }
}

export function isWritableOutput(value: unknown): value is Writer {
  return isWriter(value)
}
