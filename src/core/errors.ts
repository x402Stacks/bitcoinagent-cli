import { CommanderError } from 'commander'
import { ZodError } from 'zod'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_ERROR'
  | 'PAYMENT_REQUIRED'

export class CliError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends CliError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details)
  }
}

export class NotFoundError extends CliError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, details)
  }
}

export class InternalError extends CliError {
  constructor(message = 'An unexpected error occurred.', details?: unknown) {
    super('INTERNAL_ERROR', message, details)
  }
}

export class UpstreamError extends CliError {
  constructor(message = 'Upstream provider is unavailable.', details?: unknown) {
    super('UPSTREAM_ERROR', message, details)
  }
}

export class PaymentRequiredError extends CliError {
  constructor(message = 'Payment is required and was not accepted.', details?: unknown) {
    super('PAYMENT_REQUIRED', message, details)
  }
}

export function normalizeError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error
  }

  if (error instanceof ZodError) {
    return new ValidationError('Invalid command input.', error.flatten())
  }

  if (error instanceof CommanderError) {
    return new ValidationError(error.message)
  }

  if (error instanceof Error) {
    return new InternalError(undefined, { cause: error.message })
  }

  return new InternalError(undefined, { cause: error })
}
