import type { ApiClient } from './api-client.js'
import type {
  TwitterFollowingsResult,
  TwitterHighlightsResult,
  TwitterProfileResult,
  TwitterTweet,
  TwitterTweetsResult,
  TwitterUser,
} from '../types/commands.js'

export async function getTwitterProfile(
  client: ApiClient,
  username: string,
  timestamp: string,
): Promise<TwitterProfileResult> {
  const { data, provider } = await client.get<TwitterUser>('/api/v1/twitter/profile', {
    username,
  })
  return { ...data, provider, timestamp }
}

export async function listTwitterTweets(
  client: ApiClient,
  userId: string,
  count: number,
  timestamp: string,
): Promise<TwitterTweetsResult> {
  const { data, provider } = await client.get<TwitterTweet[]>('/api/v1/twitter/tweets', {
    user_id: userId,
    count,
  })
  return { userId, count, items: data, provider, timestamp }
}

export async function listTwitterHighlights(
  client: ApiClient,
  userId: string,
  count: number,
  timestamp: string,
): Promise<TwitterHighlightsResult> {
  const { data, provider } = await client.get<TwitterTweet[]>('/api/v1/twitter/highlights', {
    user_id: userId,
    count,
  })
  return { userId, count, items: data, provider, timestamp }
}

export async function listTwitterFollowings(
  client: ApiClient,
  userId: string,
  count: number,
  timestamp: string,
): Promise<TwitterFollowingsResult> {
  const { data, provider } = await client.get<TwitterUser[]>('/api/v1/twitter/followings', {
    user_id: userId,
    count,
  })
  return { userId, count, items: data, provider, timestamp }
}