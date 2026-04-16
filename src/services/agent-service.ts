import { NotFoundError } from '../core/errors.js'
import type { RunCommandResult, StatusCommandResult, StatusCommandState } from '../types/commands.js'

function toTaskId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized.length > 0 ? `task_${normalized}` : 'task_unknown'
}

export function runAgentTask(task: string, timestamp: string): RunCommandResult {
  const normalizedTask = task.trim()

  return {
    taskId: toTaskId(normalizedTask),
    task: normalizedTask,
    status: 'completed',
    summary: `Completed fake agent task: ${normalizedTask}`,
    steps: ['validate input', 'plan work', 'report completion'],
    timestamp,
  }
}

function getDerivedStatus(taskId: string): StatusCommandState {
  if (taskId.endsWith('_queued')) {
    return 'queued'
  }

  if (taskId.endsWith('_running')) {
    return 'running'
  }

  return 'completed'
}

export function getAgentTaskStatus(id: string, timestamp: string): StatusCommandResult {
  const normalizedId = id.trim()

  if (normalizedId === 'explode') {
    throw new Error('Synthetic failure for tests')
  }

  if (normalizedId === 'missing') {
    throw new NotFoundError(`Task '${normalizedId}' was not found.`)
  }

  const status = getDerivedStatus(normalizedId)
  const progress = status === 'queued' ? 0 : status === 'running' ? 55 : 100

  return {
    taskId: normalizedId,
    status,
    progress,
    summary: `Task ${normalizedId} is ${status}.`,
    timestamp,
  }
}
