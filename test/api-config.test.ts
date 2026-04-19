import { describe, expect, it } from 'vitest'
import { readApiConfig } from '../src/core/api-config.js'
import { ValidationError } from '../src/core/errors.js'

describe('readApiConfig', () => {
  it('falls back to defaults when env is empty', () => {
    expect(readApiConfig({})).toEqual({
      baseURL: 'http://localhost:3000',
      timeoutMs: 60_000,
    })
  })

  it('trims trailing slash on API_BASE_URL', () => {
    expect(readApiConfig({ API_BASE_URL: 'https://api.example.com/' }).baseURL).toBe(
      'https://api.example.com',
    )
  })

  it('reads API_TIMEOUT_MS as positive integer', () => {
    expect(readApiConfig({ API_TIMEOUT_MS: '15000' }).timeoutMs).toBe(15_000)
  })

  it('rejects non-numeric API_TIMEOUT_MS', () => {
    expect(() => readApiConfig({ API_TIMEOUT_MS: 'abc' })).toThrow(ValidationError)
  })

  it('rejects zero or negative timeout', () => {
    expect(() => readApiConfig({ API_TIMEOUT_MS: '0' })).toThrow(ValidationError)
  })
})