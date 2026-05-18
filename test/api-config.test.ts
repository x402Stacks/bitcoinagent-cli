import { describe, expect, it } from 'vitest'

import { readBitcoinAgentApiConfig } from '../src/core/api-config.js'

describe('bitcoinagent API config', () => {
  it('defaults to the hosted x402 API when no override is set', () => {
    expect(readBitcoinAgentApiConfig({}).baseUrl).toBe('https://agentsats.stacksx402.com')
  })
})
