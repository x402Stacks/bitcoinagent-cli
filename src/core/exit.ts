import type { CliError } from './errors.js'

export function getExitCode(error: CliError): number {
  switch (error.code) {
    case 'NOT_FOUND':
      return 2
    case 'UPSTREAM_ERROR':
      return 3
    case 'PAYMENT_REQUIRED':
      return 4
    case 'VALIDATION_ERROR':
    case 'INTERNAL_ERROR':
    default:
      return 1
  }
}
