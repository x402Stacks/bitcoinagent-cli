import tab from '@bomb.sh/tab/commander'
import type { Command } from 'commander'

export function registerCompletionSupport(program: Command) {
  return tab(program)
}
