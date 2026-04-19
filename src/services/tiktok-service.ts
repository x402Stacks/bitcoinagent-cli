import type { ApiClient } from './api-client.js'
import type {
  TiktokProfile,
  TiktokProfileResult,
  TiktokVideo,
  TiktokVideosResult,
} from '../types/commands.js'

export async function getTiktokProfile(
  client: ApiClient,
  username: string,
  timestamp: string,
): Promise<TiktokProfileResult> {
  const { data, provider } = await client.get<TiktokProfile>('/api/v1/tiktok/profile', {
    username,
  })
  return { ...data, provider, timestamp }
}

export async function listTiktokVideos(
  client: ApiClient,
  username: string,
  timestamp: string,
): Promise<TiktokVideosResult> {
  const { data, provider } = await client.get<TiktokVideo[]>('/api/v1/tiktok/videos', {
    username,
  })
  return { username, videos: data, provider, timestamp }
}