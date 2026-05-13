import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('README examples', () => {
  it('documents a working local development help command', () => {
    const readme = readFileSync('README.md', 'utf8')

    expect(readme).toContain('pnpm dev --help')
    expect(readme).not.toContain('pnpm dev -- --help')
  })
})
