export type WalletCommandOptions = {
  json?: boolean
  plain?: boolean
}

export type WalletProvider = 'private-key' | 'ows'

export type WalletCommandResult = {
  address: string
  network: 'mainnet' | 'testnet'
  provider: WalletProvider
  timestamp: string
}

export type WalletSetupResult = {
  provider: 'ows'
  preview: true
  warning: string
  wallet: string
  address: string
  network: 'mainnet' | 'testnet'
  chain: string
  owsCli: string
  sourceDir: string
  configPath: string
  commit: string
  timestamp: string
}

export type ApiCommandOptions = {
  json?: boolean
  plain?: boolean
  apiUrl?: string
}

export type ApiEndpointResult = {
  method: 'GET' | 'POST'
  endpoint: string
  url: string
  statusCode: number
  provider?: string
  response: unknown
  paymentResponse?: unknown
  timestamp: string
}
