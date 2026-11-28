import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import {
  buildInviteLink,
  copyTextSilently,
  formatInviteLinksForCopy
} from './inviteLinks'

vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

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
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true)
    })
    vi.mocked(reportError).mockImplementation(() => undefined)
    return () => {
      Reflect.deleteProperty(document, 'execCommand')
    }
  })

  it('does not report an error when the copy succeeds', async () => {
    await expect(copyTextSilently('hello')).resolves.toBe(true)

    expect(reportError).not.toHaveBeenCalled()
  })

  it('does not report a recovered Clipboard API rejection', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error('denied')
    )

    await expect(copyTextSilently('hello')).resolves.toBe(true)

    expect(reportError).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'returns false', copy: () => false },
    {
      name: 'throws',
      copy: () => {
        throw new Error('copy unavailable')
      }
    }
  ])(
    'reports one invite-specific failure when the fallback $name',
    async ({ copy }) => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
        new Error('denied')
      )
      vi.mocked(document.execCommand).mockImplementation(copy)

      await expect(copyTextSilently('text')).resolves.toBe(false)

      expect(reportError).toHaveBeenCalledTimes(1)
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'error_copying_invite_link',
        surface: 'workspace'
      })
    }
  )
})
