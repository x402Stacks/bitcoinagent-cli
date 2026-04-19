import { describe, expect, it } from 'vitest'
import {
  InternalError,
  NotFoundError,
  PaymentRequiredError,
  UpstreamError,
  ValidationError,
  normalizeError,
} from '../src/core/errors.js'
import { getExitCode } from '../src/core/exit.js'

describe('error codes & exit mapping', () => {
  it('UpstreamError maps to exit code 3', () => {
    expect(getExitCode(new UpstreamError('upstream down'))).toBe(3)
  })
  it('PaymentRequiredError maps to exit code 4', () => {
    expect(getExitCode(new PaymentRequiredError('payment failed'))).toBe(4)
  })
  it('NotFoundError still exit 2, ValidationError still 1, InternalError still 1', () => {
    expect(getExitCode(new NotFoundError('x'))).toBe(2)
    expect(getExitCode(new ValidationError('x'))).toBe(1)
    expect(getExitCode(new InternalError('x'))).toBe(1)
  })
  it('normalizeError passes through CliError subclasses', () => {
    const e = new UpstreamError('upstream down', { status: 502 })
    expect(normalizeError(e)).toBe(e)
  })
})