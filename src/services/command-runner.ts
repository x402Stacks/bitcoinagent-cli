import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { InternalError } from '../core/errors.js'
import type { CommandRunner } from '../types/context.js'

const execFileAsync = promisify(execFile)

export const runCommand: CommandRunner = async (command, args, options = {}) => {
  try {
    const result = await execFileAsync(command, [...args], {
      env: options.env,
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    }
  } catch (error) {
    const commandError = error as Error & {
      code?: unknown
      stdout?: unknown
      stderr?: unknown
    }
    const details =
      error instanceof Error
        ? {
            command,
            args,
            cause: error.message,
            ...(typeof commandError.code === 'number' ? { exitCode: commandError.code } : {}),
            ...(typeof commandError.stdout === 'string' ? { stdout: commandError.stdout } : {}),
            ...(typeof commandError.stderr === 'string' ? { stderr: commandError.stderr } : {}),
          }
        : { command, args, cause: error }

    throw new InternalError('Failed to run external command.', details)
  }
}
