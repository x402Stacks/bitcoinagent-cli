import { describe, expect, it } from 'vitest'
import { mapApiError, unwrapEnvelope } from '../src/services/api-envelope.js'
import {
  InternalError,
  NotFoundError,
  PaymentRequiredError,
  UpstreamError,
  ValidationError,
} from '../src/core/errors.js'

describe('mapApiError', () => {
  it('400 invalid_input → ValidationError', () => {
    expect(mapApiError(400, 'invalid_input', 'GET /x')).toBeInstanceOf(ValidationError)
  })
  it('404 not_found → NotFoundError', () => {
    expect(mapApiError(404, 'not_found', 'GET /x')).toBeInstanceOf(NotFoundError)
  })
  it('402 → PaymentRequiredError', () => {
    expect(mapApiError(402, undefined, 'GET /x')).toBeInstanceOf(PaymentRequiredError)
  })
  it('502 provider_error → UpstreamError', () => {
    expect(mapApiError(502, 'provider_error', 'GET /x')).toBeInstanceOf(UpstreamError)
  })
  it('500 → InternalError', () => {
    expect(mapApiError(500, 'internal_error', 'GET /x')).toBeInstanceOf(InternalError)
  })
  it('unknown status with error code falls back to InternalError with details', () => {
    const e = mapApiError(418, 'teapot', 'GET /x')
    expect(e).toBeInstanceOf(InternalError)
    expect(e.details).toMatchObject({ status: 418, apiErrorCode: 'teapot' })
  })
})

describe('unwrapEnvelope', () => {
  it('returns data and provider', () => {
    expect(unwrapEnvelope({ data: { x: 1 }, meta: { provider: 'mock' } })).toEqual({
      data: { x: 1 },
      provider: 'mock',
    })
  })
  it('throws InternalError on malformed shape', () => {
    expect(() => unwrapEnvelope({ foo: 'bar' })).toThrow(InternalError)
  })
})