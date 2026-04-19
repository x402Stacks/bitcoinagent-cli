import type { ApiClient } from './api-client.js'

export async function getHealth(client: ApiClient): Promise<{ status: string }> {
  return client.getRaw<{ status: string }>('/health')
}