import { describe, expect, it, vi } from 'vitest'
import {
  getTwitterProfile,
  listTwitterHighlights,
  listTwitterTweets,
  listTwitterFollowings,
} from '../src/services/twitter-service.js'

const ts = '2026-04-16T00:00:00.000Z'

function clientWith(expect: (path: string, params?: unknown) => unknown, data: unknown) {
  return {
    get: vi.fn(async (path: string, params?: unknown) => {
      expect(path, params)
      return { data, provider: 'rapidapi' }
    }),
  }
}

describe('twitter-service', () => {
  it('getTwitterProfile calls /api/v1/twitter/profile with username', async () => {
    const client = clientWith(
      (path, params) => {
        expect(path).toBe('/api/v1/twitter/profile')
        expect(params).toEqual({ username: 'MrBeast' })
      },
      { RestID: '1', Username: 'MrBeast', DisplayName: '', Description: '', Followers: 0, Following: 0, TweetsCount: 0, Location: '', ProfileImageURL: '', IsBlueVerified: false },
    )
    const res = await getTwitterProfile(client, 'MrBeast', ts)
    expect(res.provider).toBe('rapidapi')
    expect(res.timestamp).toBe(ts)
  })

  it('listTwitterTweets passes user_id and count', async () => {
    const client = clientWith(
      (path, params) => {
        expect(path).toBe('/api/v1/twitter/tweets')
        expect(params).toEqual({ user_id: '123', count: 10 })
      },
      [],
    )
    const res = await listTwitterTweets(client, '123', 10, ts)
    expect(res.userId).toBe('123')
    expect(res.count).toBe(10)
  })

  it('listTwitterHighlights shape', async () => {
    const client = clientWith(
      (path, params) => {
        expect(path).toBe('/api/v1/twitter/highlights')
        expect(params).toEqual({ user_id: '123', count: 20 })
      },
      [],
    )
    await listTwitterHighlights(client, '123', 20, ts)
  })

  it('listTwitterFollowings shape', async () => {
    const client = clientWith(
      (path, params) => {
        expect(path).toBe('/api/v1/twitter/followings')
        expect(params).toEqual({ user_id: '123', count: 20 })
      },
      [],
    )
    await listTwitterFollowings(client, '123', 20, ts)
  })
})