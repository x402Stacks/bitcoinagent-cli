import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('.env.example', () => {
  it('documents the CLI environment variables needed for hosted API and x402 use', () => {
    const envExample = readFileSync('.env.example', 'utf8')

    expect(envExample).toContain('BITCOINAGENT_API_URL=')
    expect(envExample).toContain('AGENTSATS_WALLET_PROVIDER=')
    expect(envExample).toContain('STACKS_PRIVATE_KEY=')
    expect(envExample).toContain('STACKS_NETWORK=mainnet')
    expect(envExample).toContain('OWS_WALLET=')
    expect(envExample).toContain('OWS_CHAIN=stacks:1')
    expect(envExample).toContain('OWS_CLI=')
  })
})
