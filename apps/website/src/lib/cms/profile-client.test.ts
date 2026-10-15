import { describe, expect, it, vi } from 'vitest'
import { searchProfiles } from './profile-client'

const choice = {
  id: 'fPc7irbKt2VLbuIkRrWuC5TH5lX2',
  label: 'Profile fixture',
  username: 'profile-fixture',
  avatar_url: 'https://example.org/avatar.png'
}
describe('private author picker transport', () => {
  it('reads same-origin public display choices without putting credentials in a URL', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ items: [choice] }))
    vi.mocked(fetch).mockImplementation(fetcher)
    const result = await searchProfiles(
      'Profile fixture',
      new AbortController().signal
    )
    expect(result).toEqual({ ok: true, items: [choice] })
    expect(fetcher).toHaveBeenCalledWith(
      '/admin/content-api/profiles?q=Profile+fixture',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error'
      })
    )
  })
  it.for(['', 'x', 'email@example.org', ' line', 'line\n', 'x'.repeat(101)])(
    'refuses unsupported query %j without a request',
    async (query) => {
      const fetcher = vi.fn<typeof fetch>()
      vi.mocked(fetch).mockImplementation(fetcher)
      expect(await searchProfiles(query, new AbortController().signal)).toEqual(
        { ok: false }
      )
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it.for([
    { items: [{ ...choice, email: 'must-not-escape@example.org' }] },
    { items: [{ ...choice, avatar_url: 'javascript:alert(1)' }] },
    { items: [{ ...choice, avatar_url: 'https://secret@example.org/a' }] },
    { items: Array.from({ length: 21 }, () => choice) }
  ])('fails closed for an invalid directory response %#', async (body) => {
    vi.mocked(fetch).mockImplementation(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
    )
    expect(
      await searchProfiles('Profile', new AbortController().signal)
    ).toEqual({ ok: false })
  })
})
