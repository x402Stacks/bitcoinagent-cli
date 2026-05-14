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
}

export type WalletConfig = StacksConfig | OwsWalletConfig

function readStacksNetwork(env: NodeJS.ProcessEnv): StacksNetwork {
  const rawNetwork = env.STACKS_NETWORK?.trim()
  if (rawNetwork && rawNetwork !== 'mainnet' && rawNetwork !== 'testnet') {
    throw new ValidationError(
      `STACKS_NETWORK must be "mainnet" or "testnet" (got "${rawNetwork}").`,
    )
  }

  return (rawNetwork as StacksNetwork | undefined) ?? 'testnet'
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

export function readWalletConfig(env: NodeJS.ProcessEnv): WalletConfig {
  const rawProvider = env.AGENTSATS_WALLET_PROVIDER?.trim() || 'private-key'

  if (rawProvider !== 'private-key' && rawProvider !== 'ows') {
    throw new ValidationError(
      `AGENTSATS_WALLET_PROVIDER must be "private-key" or "ows" (got "${rawProvider}").`,
    )
  }

  const network = readStacksNetwork(env)

  if (rawProvider === 'ows') {
    const wallet = env.OWS_WALLET?.trim()
    if (!wallet) {
      throw new ValidationError('OWS_WALLET environment variable is required when AGENTSATS_WALLET_PROVIDER=ows.')
    }

    const chain = env.OWS_CHAIN?.trim() || defaultOwsChain(network)

    return {
      provider: 'ows',
      wallet,
      chain,
      network: networkFromOwsChain(chain),
      cliPath: env.OWS_CLI?.trim() || 'ows',
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

export function readStacksConfig(env: NodeJS.ProcessEnv): StacksConfig {
  const config = readWalletConfig(env)

  if (config.provider === 'ows') {
    throw new ValidationError('STACKS_PRIVATE_KEY environment variable is required.')
  }

  return config
}
