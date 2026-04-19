import { describe, expect, it } from 'vitest'
import { getFreeTransport, getPaidTransport } from '../src/services/transport.js'
import { ValidationError } from '../src/core/errors.js'

describe('transport factory', () => {
  it('getFreeTransport returns an ApiClient with no private key required', () => {
    const client = getFreeTransport({ env: {} })
    expect(client.get).toBeTypeOf('function')
  })

  it('getPaidTransport throws ValidationError when STACKS_PRIVATE_KEY is missing', () => {
    expect(() => getPaidTransport({ env: {} })).toThrow(ValidationError)
  })
})