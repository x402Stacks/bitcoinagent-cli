import { privateKeyToAccount } from 'x402-stacks'

import type { StacksConfig } from '../core/stacks-config.js'
import type { WalletCommandResult } from '../types/commands.js'

export function getWalletInfo(
  config: StacksConfig,
  timestamp: string,
): WalletCommandResult {
  const account = privateKeyToAccount(config.privateKey, config.network)

  return {
    address: account.address,
    network: config.network,
    timestamp,
  }
}
