import { describe, expect, it, vi } from 'vitest'

import {
  buildInviteLink,
  copyTextSilently,
  formatInviteLinksForCopy
} from './inviteLinks'

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  })
}

describe('buildInviteLink', () => {
  it('builds an ?invite=TOKEN link on the current origin', () => {
    expect(buildInviteLink('tok-123')).toBe(
      `${window.location.origin}/?invite=tok-123`
    )
  })

  it('url-encodes the token', () => {
    expect(buildInviteLink('a b&c')).toBe(
      `${window.location.origin}/?invite=a+b%26c`
    )
  })
})

describe('formatInviteLinksForCopy', () => {
  it('joins rows as tab-separated email/url pairs, one per line', () => {
    expect(
      formatInviteLinksForCopy([
        { email: 'a@b.com', url: 'https://x/?invite=1' },
        { email: 'c@d.com', url: 'https://x/?invite=2' }
      ])
    ).toBe('a@b.com\thttps://x/?invite=1\nc@d.com\thttps://x/?invite=2')
  })

  it('returns an empty string for no rows', () => {
    expect(formatInviteLinksForCopy([])).toBe('')
  })
})

describe('copyTextSilently', () => {
  it('writes the text to the clipboard and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    await expect(copyTextSilently('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('reports failure without throwing when the clipboard rejects', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(copyTextSilently('hello')).resolves.toBe(false)
  })
})
