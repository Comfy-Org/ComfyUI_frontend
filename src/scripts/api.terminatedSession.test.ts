import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const mockIsSessionTerminated = vi.hoisted(() => vi.fn(() => false))

// The short-circuit only exists on cloud builds.
vi.mock('@/platform/distribution/types', () => ({
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  isSessionTerminated: mockIsSessionTerminated
}))

vi.stubGlobal('fetch', vi.fn())

describe('api.fetchApi on a terminated session', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset()
    api.user = 'test-user'
  })

  it('short-circuits with a parseable 401 and never reaches the network', async () => {
    mockIsSessionTerminated.mockReturnValue(true)

    const response = await api.fetchApi('/jobs')

    expect(response.status).toBe(401)
    // A body-less response would make unguarded .json() callers throw a
    // SyntaxError instead of surfacing the auth failure.
    await expect(response.json()).resolves.toEqual({})
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
