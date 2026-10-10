import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError, api } from '@/scripts/api'

describe('api.getSettings', () => {
  it('returns the settings payload', async () => {
    const settings = { 'Comfy.ColorPalette': 'dark' }
    vi.spyOn(api, 'fetchApi').mockResolvedValue(Response.json(settings))

    await expect(api.getSettings()).resolves.toEqual(settings)
  })

  // HTTP/2 carries no reason phrase, so `statusText` is empty on every real
  // cloud response. An error built from it alone reaches Sentry as the
  // untitled "Error: No error message" group — the largest user-facing group
  // on cloud-frontend-prod — so the message must not depend on it.
  // The reason phrase in the second row is deliberately NOT `Unauthorized`.
  // That is also the fallback, so a row using it cannot tell "the phrase the
  // protocol supplied was used" from "the fallback was used" — both branches
  // produce the same string and the row passes either way.
  it.for([
    {
      name: 'HTTP/2, no reason phrase',
      statusText: '',
      expected: 'Failed to load settings: 401 Unauthorized'
    },
    {
      name: 'HTTP/1.1, reason phrase present',
      statusText: 'Token Expired',
      expected: 'Failed to load settings: 401 Token Expired'
    }
  ])(
    'names the failed request on a 401 ($name)',
    async ({ statusText, expected }) => {
      vi.spyOn(api, 'fetchApi').mockResolvedValue(
        new Response(null, { status: 401, statusText })
      )

      await expect(api.getSettings()).rejects.toThrow(UnauthorizedError)
      await expect(api.getSettings()).rejects.toThrow(expected)
    }
  )
})
