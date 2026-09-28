import { describe, expect, it, vi } from 'vitest'

import { fetchDistributionsEnabled } from '@/platform/workflow/deploy/services/platformFlagsApi'
import type { AuthHeader } from '@/types/authTypes'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

const bearer: AuthHeader = { Authorization: 'Bearer firebase-token' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('fetchDistributionsEnabled', () => {
  it('asks the platform with the signed-in bearer and reads its answer', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ enabled: true }))

    await expect(
      fetchDistributionsEnabled(() => Promise.resolve(bearer))
    ).resolves.toBe(true)

    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe(
      'https://platform.comfy.org/api/flags/distributions-enabled'
    )
    expect(init).toEqual({ headers: bearer })
  })

  it.for([
    {
      case: 'the platform does not serve the route yet',
      header: bearer,
      response: () => new Response('Not found', { status: 404 })
    },
    {
      case: 'the token is refused',
      header: bearer,
      response: () => json({ error: 'unauthorized' }, 401)
    },
    {
      case: 'the answer is not the contract',
      header: bearer,
      response: () => json({ enabled: 'yes' })
    },
    {
      case: 'the body is not JSON',
      header: bearer,
      response: () => new Response('<html>', { status: 200 })
    },
    {
      case: 'the user signed in with an API key',
      header: { 'X-API-KEY': 'key' },
      response: () => json({ enabled: true })
    },
    {
      case: 'nobody is signed in',
      header: null,
      response: () => json({ enabled: true })
    }
  ])('reads as no when $case', async ({ header, response }) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response())

    await expect(
      fetchDistributionsEnabled(() =>
        Promise.resolve<AuthHeader | null>(header)
      )
    ).resolves.toBe(false)
  })

  it('reads as no when the platform cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('CORS'))

    await expect(
      fetchDistributionsEnabled(() => Promise.resolve(bearer))
    ).resolves.toBe(false)
  })
})
