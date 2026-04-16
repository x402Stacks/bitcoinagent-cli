export type OutputMode = 'human' | 'json' | 'plain'

export type CliErrorPayload = {
  code: string
  message: string
  details?: unknown
}

export type CliResponse<T> = {
  success: boolean
  data?: T
  error?: CliErrorPayload
  meta: {
    timestamp: string
    mode: OutputMode
  }
}
