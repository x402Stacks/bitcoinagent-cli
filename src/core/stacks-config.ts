import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

import { ValidationError } from './errors.js'

export type StacksNetwork = 'mainnet' | 'testnet'
export type WalletProvider = 'private-key' | 'ows'

export interface StacksConfig {
  provider: 'private-key'
  privateKey: string
  network: StacksNetwork
}

export interface OwsWalletConfig {
  provider: 'ows'
  wallet: string
  chain: string
  network: StacksNetwork
  cliPath: string
  keyEncoding: 'compressed' | 'uncompressed'
}

export type WalletConfig = StacksConfig | OwsWalletConfig

export interface SavedOwsWalletConfig {
  provider?: string
  wallet?: string
  chain?: string
  cliPath?: string
  keyEncoding?: 'compressed' | 'uncompressed'
  preview?: {
    source: string
    commit: string
  }
}

export interface AgentsatsConfigFile {
  wallet?: SavedOwsWalletConfig
  wallets?: Record<string, SavedOwsWalletConfig>
}

export interface ReadWalletConfigOptions {
  walletName?: string
}

function resolveAgentsatsHome(env: NodeJS.ProcessEnv) {
  const configuredHome = env.AGENTSATS_HOME?.trim()
  if (configuredHome) {
    return configuredHome
  }

  const home = env.HOME?.trim() || homedir()
  if (!home) {
    throw new ValidationError('HOME or AGENTSATS_HOME is required to locate the AgentSats config directory.')
  }

  return path.join(home, '.agentsats')
}

export function resolveAgentsatsConfigPath(env: NodeJS.ProcessEnv) {
  return env.AGENTSATS_CONFIG_PATH?.trim() || path.join(resolveAgentsatsHome(env), 'config.json')
}

export function readAgentsatsConfig(env: NodeJS.ProcessEnv): AgentsatsConfigFile | undefined {
  const configPath = resolveAgentsatsConfigPath(env)
  if (!existsSync(configPath)) {
    return undefined
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as AgentsatsConfigFile
  } catch (error) {
    throw new ValidationError('Failed to read AgentSats config file.', {
      configPath,
      cause: error instanceof Error ? error.message : error,
    })
  }
}

export async function writeAgentsatsConfig(env: NodeJS.ProcessEnv, config: AgentsatsConfigFile) {
  const configPath = resolveAgentsatsConfigPath(env)
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return configPath
}

function readStacksNetwork(env: NodeJS.ProcessEnv, configuredNetwork?: unknown): StacksNetwork {
  const rawNetwork = env.STACKS_NETWORK?.trim()
    || (typeof configuredNetwork === 'string' ? configuredNetwork.trim() : undefined)
  if (rawNetwork && rawNetwork !== 'mainnet' && rawNetwork !== 'testnet') {
    throw new ValidationError(
      `STACKS_NETWORK must be "mainnet" or "testnet" (got "${rawNetwork}").`,
    )
  }

  return (rawNetwork as StacksNetwork | undefined) ?? 'mainnet'
}

function networkFromOwsChain(chain: string): StacksNetwork {
  if (chain === 'stacks:1') {
    return 'mainnet'
  }

  if (chain === 'stacks:2147483648') {
    return 'testnet'
  }

  throw new ValidationError(
    `OWS_CHAIN must be "stacks:1" or "stacks:2147483648" (got "${chain}").`,
  )
}

function defaultOwsChain(network: StacksNetwork) {
  return network === 'mainnet' ? 'stacks:1' : 'stacks:2147483648'
}

function readNamedOwsWalletConfig(
  config: AgentsatsConfigFile | undefined,
  walletName: string | undefined,
) {
  if (!config || !walletName) {
    return undefined
  }

  const namedWallet = config.wallets?.[walletName]
  if (namedWallet) {
    return namedWallet
  }

  if (config.wallet?.wallet?.trim() === walletName) {
    return config.wallet
  }

  return undefined
}

export function readWalletConfig(env: NodeJS.ProcessEnv, options: ReadWalletConfigOptions = {}): WalletConfig {
  const config = readAgentsatsConfig(env)
  const selectedWalletName = options.walletName?.trim()
  const envWalletName = env.OWS_WALLET?.trim()
  const explicitWalletName = selectedWalletName || envWalletName
  const defaultConfiguredWallet = config?.wallet
  const walletName = explicitWalletName || defaultConfiguredWallet?.wallet?.trim()
  const configuredWallet = walletName
    ? (readNamedOwsWalletConfig(config, walletName) ?? (explicitWalletName ? undefined : defaultConfiguredWallet))
    : defaultConfiguredWallet
  const rawProvider = selectedWalletName
    ? 'ows'
    : env.AGENTSATS_WALLET_PROVIDER?.trim()
    || (envWalletName ? 'ows' : undefined)
    || (env.STACKS_PRIVATE_KEY?.trim() ? 'private-key' : undefined)
    || configuredWallet?.provider
    || 'private-key'

  if (rawProvider !== 'private-key' && rawProvider !== 'ows') {
    throw new ValidationError(
      `AGENTSATS_WALLET_PROVIDER must be "private-key" or "ows" (got "${rawProvider}").`,
    )
  }

  const network = readStacksNetwork(env)

  if (rawProvider === 'ows') {
    const wallet = walletName
    if (!wallet) {
      throw new ValidationError('OWS_WALLET environment variable is required when AGENTSATS_WALLET_PROVIDER=ows.')
    }

    const chain = env.OWS_CHAIN?.trim() || configuredWallet?.chain?.trim() || defaultOwsChain(network)

    return {
      provider: 'ows',
      wallet,
      chain,
      network: networkFromOwsChain(chain),
      cliPath: env.OWS_CLI?.trim() || configuredWallet?.cliPath?.trim() || 'ows',
      keyEncoding: readOwsStacksKeyEncoding(env, configuredWallet?.keyEncoding),
    }
  }

  const privateKey = env.STACKS_PRIVATE_KEY?.trim()
  if (!privateKey) {
    throw new ValidationError(
      'STACKS_PRIVATE_KEY environment variable is required.',
    )
  }

  return {
    provider: 'private-key',
    privateKey,
    network,
  }
}

function readOwsStacksKeyEncoding(
  env: NodeJS.ProcessEnv,
  configuredEncoding?: unknown,
): 'compressed' | 'uncompressed' {
  const rawEncoding = env.OWS_STACKS_KEY_ENCODING?.trim()
    || (typeof configuredEncoding === 'string' ? configuredEncoding.trim() : undefined)
    || 'uncompressed'

  if (rawEncoding !== 'compressed' && rawEncoding !== 'uncompressed') {
    throw new ValidationError(
      `OWS_STACKS_KEY_ENCODING must be "compressed" or "uncompressed" (got "${rawEncoding}").`,
    )
  }

  return rawEncoding
}

export function readOptionalWalletConfig(
  env: NodeJS.ProcessEnv,
  options: ReadWalletConfigOptions = {},
): WalletConfig | undefined {
  const hasExplicitEnvWallet = Boolean(
    env.AGENTSATS_WALLET_PROVIDER?.trim() ||
    env.STACKS_PRIVATE_KEY?.trim(),
  )
  const hasSelectedWallet = Boolean(options.walletName?.trim())
  const config = readAgentsatsConfig(env)

  if (!hasExplicitEnvWallet && !hasSelectedWallet && config?.wallet === undefined) {
    return undefined
  }

  return readWalletConfig(env, options)
}

export function readStacksConfig(env: NodeJS.ProcessEnv): StacksConfig {
  const config = readWalletConfig(env)

  if (config.provider === 'ows') {
    throw new ValidationError('STACKS_PRIVATE_KEY environment variable is required.')
  }

  return config
}
