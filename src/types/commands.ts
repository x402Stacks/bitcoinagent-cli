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

export type ServiceSummary = { name: string; has_paid_endpoints: boolean }

export type ServicesListResult = {
  services: ServiceSummary[]
  provider: string
  timestamp: string
}

export type EndpointPayment = {
  scheme: string
  required: boolean
  enabled: boolean
  asset: string
  amount: string
  network: string
}

export type EndpointSpec = {
  method: string
  path: string
  description: string
  query_params: string[]
  payment?: EndpointPayment
}

export type ServiceEndpointsResult = {
  service: string
  endpoints: EndpointSpec[]
  provider: string
  timestamp: string
}

export type TiktokProfile = {
  Username: string
  DisplayName: string
  Followers: number
}

export type TiktokProfileResult = TiktokProfile & {
  provider: string
  timestamp: string
}

export type TiktokVideo = {
  ID: string
  Title: string
  Views: number
}

export type TiktokVideosResult = {
  username: string
  videos: TiktokVideo[]
  provider: string
  timestamp: string
}
