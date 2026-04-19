import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execute, TEST_PRIVATE_KEY } from './helpers/execute.js'

const paidGet = vi.fn()

vi.mock('../src/services/transport.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/transport.js')>(
    '../src/services/transport.js',
  )
  return {
    ...actual,
    getPaidTransport: (ctx: { env: NodeJS.ProcessEnv }) => {
      if (!ctx.env.STACKS_PRIVATE_KEY) return actual.getPaidTransport(ctx)
      return { get: paidGet }
    },
    getFreeTransport: vi.fn(),
  }
})

beforeEach(() => {
  paidGet.mockReset()
})

describe('twitter profile — json', () => {
  it('returns paid profile', async () => {
    paidGet.mockResolvedValueOnce({
      data: {
        RestID: '2455740283',
        Username: 'MrBeast',
        DisplayName: 'MrBeast',
        Description: '',
        Followers: 25_000_000,
        Following: 500,
        TweetsCount: 3000,
        Location: 'US',
        ProfileImageURL: 'https://x/y.jpg',
        IsBlueVerified: true,
      },
      provider: 'rapidapi',
    })
    const r = await execute(['twitter', 'profile', '--username', 'MrBeast', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(0)
    expect(p.data.Username).toBe('MrBeast')
    expect(paidGet).toHaveBeenCalledWith('/api/v1/twitter/profile', { username: 'MrBeast' })
  })

  it('returns VALIDATION_ERROR when STACKS_PRIVATE_KEY missing', async () => {
    const r = await execute(['twitter', 'profile', '--username', 'MrBeast', '--json'], {})
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(1)
    expect(p.error.code).toBe('VALIDATION_ERROR')
    expect(p.error.message).toContain('STACKS_PRIVATE_KEY')
  })

  it('returns PAYMENT_REQUIRED with exit 4 when settlement fails', async () => {
    const { PaymentRequiredError } = await import('../src/core/errors.js')
    paidGet.mockRejectedValueOnce(new PaymentRequiredError('payment failed', { status: 402 }))
    const r = await execute(['twitter', 'profile', '--username', 'MrBeast', '--json'], {
      STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
    })
    const p = JSON.parse(r.stdout)
    expect(r.exitCode).toBe(4)
    expect(p.error.code).toBe('PAYMENT_REQUIRED')
  })
})

describe('twitter tweets — json', () => {
  it('defaults --count to 20', async () => {
    paidGet.mockResolvedValueOnce({ data: [], provider: 'rapidapi' })
    const r = await execute(
      ['twitter', 'tweets', '--user-id', '2455740283', '--json'],
      { STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY },
    )
    expect(r.exitCode).toBe(0)
    expect(paidGet).toHaveBeenCalledWith('/api/v1/twitter/tweets', {
      user_id: '2455740283',
      count: 20,
    })
  })

  it('respects --count 5', async () => {
    paidGet.mockResolvedValueOnce({ data: [], provider: 'rapidapi' })
    await execute(
      ['twitter', 'tweets', '--user-id', '2455740283', '--count', '5', '--json'],
      { STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY },
    )
    expect(paidGet).toHaveBeenCalledWith('/api/v1/twitter/tweets', {
      user_id: '2455740283',
      count: 5,
    })
  })

  it('rejects non-numeric --count with VALIDATION_ERROR', async () => {
    const r = await execute(
      ['twitter', 'tweets', '--user-id', '123', '--count', 'abc', '--json'],
      { STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY },
    )
    const p = JSON.parse(r.stdout)
    expect(p.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('twitter highlights/followings — routing', () => {
  it('highlights hits /api/v1/twitter/highlights', async () => {
    paidGet.mockResolvedValueOnce({ data: [], provider: 'rapidapi' })
    await execute(
      ['twitter', 'highlights', '--user-id', '123', '--json'],
      { STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY },
    )
    expect(paidGet).toHaveBeenCalledWith('/api/v1/twitter/highlights', {
      user_id: '123',
      count: 20,
    })
  })

  it('followings hits /api/v1/twitter/followings', async () => {
    paidGet.mockResolvedValueOnce({ data: [], provider: 'rapidapi' })
    await execute(
      ['twitter', 'followings', '--user-id', '123', '--json'],
      { STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY },
    )
    expect(paidGet).toHaveBeenCalledWith('/api/v1/twitter/followings', {
      user_id: '123',
      count: 20,
    })
  })
})