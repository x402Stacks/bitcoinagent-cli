import { describe, expect, it } from 'vitest'

import { readBitcoinAgentApiConfig } from '../src/core/api-config.js'

describe('bitcoinagent API config', () => {
  it('defaults to the x402-enabled local API when no override is set', () => {
    expect(readBitcoinAgentApiConfig({}).baseUrl).toBe('http://localhost:8082')
  })
})
