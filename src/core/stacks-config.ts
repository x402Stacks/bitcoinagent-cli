import { ValidationError } from './errors.js'

export type StacksNetwork = 'mainnet' | 'testnet'

export interface StacksConfig {
  privateKey: string
  network: StacksNetwork
}

export function readStacksConfig(env: NodeJS.ProcessEnv): StacksConfig {
  const privateKey = env.STACKS_PRIVATE_KEY?.trim()
  if (!privateKey) {
    throw new ValidationError(
      'STACKS_PRIVATE_KEY environment variable is required.',
    )
  }

  const rawNetwork = env.STACKS_NETWORK?.trim()
  if (rawNetwork && rawNetwork !== 'mainnet' && rawNetwork !== 'testnet') {
    throw new ValidationError(
      `STACKS_NETWORK must be "mainnet" or "testnet" (got "${rawNetwork}").`,
    )
  }

  return {
    privateKey,
    network: (rawNetwork as StacksNetwork | undefined) ?? 'testnet',
  }
}
