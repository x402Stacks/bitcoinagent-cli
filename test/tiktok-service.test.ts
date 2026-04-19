import { describe, expect, it, vi } from 'vitest'
import { getTiktokProfile, listTiktokVideos } from '../src/services/tiktok-service.js'

describe('tiktok-service', () => {
  it('getTiktokProfile hits /api/v1/tiktok/profile with username', async () => {
    const get = vi.fn(async () => ({
      data: { Username: 'creator_1', DisplayName: 'Creator One', Followers: 1200 },
      provider: 'mock',
    }))
    const res = await getTiktokProfile({ get }, 'creator_1', '2026-04-16T00:00:00.000Z')
    expect(get).toHaveBeenCalledWith('/api/v1/tiktok/profile', { username: 'creator_1' })
    expect(res).toEqual({
      Username: 'creator_1',
      DisplayName: 'Creator One',
      Followers: 1200,
      provider: 'mock',
      timestamp: '2026-04-16T00:00:00.000Z',
    })
  })

  it('listTiktokVideos hits /api/v1/tiktok/videos with username', async () => {
    const get = vi.fn(async () => ({
      data: [{ ID: 'v1', Title: 'First', Views: 50000 }],
      provider: 'mock',
    }))
    const res = await listTiktokVideos({ get }, 'creator_1', '2026-04-16T00:00:00.000Z')
    expect(get).toHaveBeenCalledWith('/api/v1/tiktok/videos', { username: 'creator_1' })
    expect(res.videos).toHaveLength(1)
    expect(res.username).toBe('creator_1')
  })
})