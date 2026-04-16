import type { OutputMode } from '../types/output.js'

export function resolveOutputMode(flags: { json?: boolean; plain?: boolean }): OutputMode {
  if (flags.json) {
    return 'json'
  }

  if (flags.plain) {
    return 'plain'
  }

  return 'human'
}
