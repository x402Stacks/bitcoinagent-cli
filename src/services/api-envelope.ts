import {
  InternalError,
  NotFoundError,
  PaymentRequiredError,
  UpstreamError,
  ValidationError,
} from '../core/errors.js'

export interface ApiEnvelope<T> {
  data: T
  meta: { provider: string }
}

export function unwrapEnvelope<T>(payload: unknown): { data: T; provider: string } {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    !('meta' in payload)
  ) {
    throw new InternalError('API returned a malformed response envelope.', { payload })
  }
  const meta = (payload as { meta: unknown }).meta
  const provider =
    typeof meta === 'object' && meta !== null && 'provider' in meta
      ? String((meta as { provider: unknown }).provider)
      : 'unknown'
  return { data: (payload as { data: T }).data, provider }
}

export function mapApiError(
  status: number,
  apiErrorCode: string | undefined,
  endpoint: string,
) {
  const details = { status, apiErrorCode, endpoint }
  switch (status) {
    case 400:
      return new ValidationError(
        apiErrorCode ?? 'Invalid request parameters.',
        details,
      )
    case 402:
      return new PaymentRequiredError(
        'The server requires payment for this endpoint and the attempt failed.',
        details,
      )
    case 404:
      return new NotFoundError(apiErrorCode ?? 'Resource not found.', details)
    case 502:
      return new UpstreamError('Upstream provider is unavailable.', details)
    case 500:
      return new InternalError(apiErrorCode ?? 'Server returned 500.', details)
    default:
      return new InternalError(
        `Unexpected HTTP ${status} from ${endpoint}.`,
        details,
      )
  }
}