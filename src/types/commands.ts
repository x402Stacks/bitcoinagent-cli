export type RunCommandOptions = {
  task: string
  json?: boolean
  plain?: boolean
  nonInteractive?: boolean
}

export type RunCommandResult = {
  taskId: string
  task: string
  status: 'completed'
  summary: string
  steps: string[]
  timestamp: string
}

export type StatusCommandOptions = {
  id: string
  json?: boolean
  plain?: boolean
}

export type StatusCommandState = 'queued' | 'running' | 'completed'

export type StatusCommandResult = {
  taskId: string
  status: StatusCommandState
  summary: string
  progress: number
  timestamp: string
}

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
