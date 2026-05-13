export type WalletCommandOptions = {
  json?: boolean
  plain?: boolean
}

export type WalletCommandResult = {
  address: string
  network: 'mainnet' | 'testnet'
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
