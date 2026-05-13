import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('npm package metadata', () => {
  it('publishes AgentSats as an npx-runnable CLI', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      name?: unknown
      bin?: Record<string, unknown>
      scripts?: Record<string, unknown>
    }

    expect(packageJson.name).toBe('agentsats')
    expect(packageJson.bin).toEqual({
      agentsats: './dist/index.js',
    })
    expect(packageJson.scripts?.clean).toBe('rm -rf dist')
    expect(packageJson.scripts?.build).toBe('pnpm clean && tsc -p tsconfig.json')
    expect(packageJson.scripts?.prepack).toBe('pnpm build')
  })
})
