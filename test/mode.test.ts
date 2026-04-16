import { describe, expect, it } from 'vitest'

import { resolveOutputMode } from '../src/utils/mode.js'

describe('resolveOutputMode', () => {
  it('prefers json over plain', () => {
    expect(resolveOutputMode({ json: true, plain: true })).toBe('json')
  })

  it('uses plain when json is absent', () => {
    expect(resolveOutputMode({ plain: true })).toBe('plain')
  })

  it('defaults to human', () => {
    expect(resolveOutputMode({})).toBe('human')
  })
})
