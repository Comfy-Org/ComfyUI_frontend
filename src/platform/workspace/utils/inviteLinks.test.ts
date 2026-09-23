import { afterEach, describe, expect, it, vi } from 'vitest'

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
  it('returns the bare URL for a single row', () => {
    expect(
      formatInviteLinksForCopy([
        { email: 'a@b.com', url: 'https://x/?invite=t' }
      ])
    ).toBe('https://x/?invite=t')
  })

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
  // document.execCommand does not exist in happy-dom; drop any stub so the
  // surrounding tests keep exercising the unsupported-command path.
  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand')
  })

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

  it('falls back to the legacy copy command when the Clipboard API rejects', async () => {
    // happy-dom has no document.execCommand, so the legacy branch is only
    // reachable with an explicit stub — without one it throws and the branch
    // looks covered while never running.
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true
    })

    await expect(copyTextSilently('hello')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    // The scratch textarea must not outlive the copy.
    expect(document.body.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('releases the scratch textarea when the legacy command throws', async () => {
    // The unsupported path: without a `finally` the textarea stays in the
    // body — invisible but focusable — and accumulates one per attempt.
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await copyTextSilently('hello')
    await copyTextSilently('hello again')

    expect(document.body.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('reports failure without throwing when the Clipboard API is unavailable', async () => {
    // A non-secure context (plain HTTP on a LAN host) leaves
    // navigator.clipboard undefined, so reading writeText off it throws
    // synchronously rather than rejecting.
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(copyTextSilently('hello')).resolves.toBe(false)
  })
})
