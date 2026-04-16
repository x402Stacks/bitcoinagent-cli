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
