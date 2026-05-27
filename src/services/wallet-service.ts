import { privateKeyToAccount } from 'x402-stacks'

import { NotFoundError, ValidationError } from '../core/errors.js'
import { readWalletConfig, type OwsWalletConfig, type StacksConfig } from '../core/stacks-config.js'
import type { CommandRunner } from '../types/context.js'
import type { WalletCommandResult } from '../types/commands.js'

function getPrivateKeyWalletInfo(
  config: StacksConfig,
  timestamp: string,
): WalletCommandResult {
  const account = privateKeyToAccount(config.privateKey, config.network)

  return {
    address: account.address,
    network: config.network,
    provider: 'private-key',
    timestamp,
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitWalletBlocks(output: string) {
  return output
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
}

function parseWalletName(block: string) {
  const line = block
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.startsWith('Name:'))

  return line?.slice('Name:'.length).trim()
}

export function parseOwsWalletAddress(output: string, wallet: string, chain: string) {
  const block = splitWalletBlocks(output).find((candidate) => parseWalletName(candidate) === wallet)

  if (!block) {
    throw new NotFoundError(`OWS wallet "${wallet}" was not found.`)
  }

  const accountPattern = new RegExp(
    `^${escapeRegExp(chain)}(?:\\s+\\([^)]*\\))?\\s*(?:\\u2192|->)\\s*(\\S+)`,
  )

  for (const line of block.split('\n')) {
    const match = accountPattern.exec(line.trim())
    const address = match?.[1]

    if (address) {
      return address
    }
  }

  throw new ValidationError(`OWS wallet "${wallet}" does not contain a ${chain} account.`)
}

async function getOwsWalletInfo(
  config: OwsWalletConfig,
  timestamp: string,
  commandRunner: CommandRunner,
  env: NodeJS.ProcessEnv,
): Promise<WalletCommandResult> {
  const result = await commandRunner(config.cliPath, ['wallet', 'list'], {
    env,
  })
  const address = parseOwsWalletAddress(result.stdout, config.wallet, config.chain)

  return {
    address,
    network: config.network,
    provider: 'ows',
    timestamp,
  }
}

export async function getWalletInfo(
  env: NodeJS.ProcessEnv,
  timestamp: string,
  commandRunner: CommandRunner,
  options: { walletName?: string } = {},
): Promise<WalletCommandResult> {
  const config = readWalletConfig(env, options)

  if (config.provider === 'private-key') {
    return getPrivateKeyWalletInfo(config, timestamp)
  }

  return getOwsWalletInfo(config, timestamp, commandRunner, env)
}
