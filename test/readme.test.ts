import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('README examples', () => {
  it('documents end-user npx usage instead of local development commands', () => {
    const readme = readFileSync('README.md', 'utf8')

    expect(readme).toContain('npx agentsats --help')
    expect(readme).toContain('https://agentsats.stacksx402.com/')
    expect(readme).not.toContain('## Local Development')
    expect(readme).not.toContain('For local x402 testing')
    expect(readme).not.toContain('pnpm dev')
    expect(readme).not.toContain('pnpm build')
    expect(readme).not.toContain('node dist/index.js')
  })
})
