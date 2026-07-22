import { afterEach, describe, expect, it, vi } from 'vitest'

import { isEmbeddedWebView } from '@/base/webviewDetection'

describe('isEmbeddedWebView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Android WebView', () => {
    it('detects Android WebView with wv token', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('does not flag regular Chrome on Android', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })
  })

  describe('iOS WKWebView', () => {
    it('detects iOS WKWebView (AppleWebKit without Safari/)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('does not flag regular Safari on iOS', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })

    it('does not flag Chrome on iOS (CriOS)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })

    it('does not flag Firefox on iOS (FxiOS)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })
  })

  describe('social app in-app browsers', () => {
    it('detects Facebook (FBAN)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0]'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('detects Instagram', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('detects TikTok', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 TikTok/30.0'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('detects Line', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('detects Snapchat', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.0'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })
  })

  describe('regular desktop browsers', () => {
    it('does not flag Chrome desktop', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })

    it('does not flag Firefox desktop', () => {
      const ua =
        'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })

    it('does not flag Safari desktop', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      expect(isEmbeddedWebView(ua)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(isEmbeddedWebView('')).toBe(false)
    })
  })

  describe('JS bridge detection', () => {
    it('detects webkit.messageHandlers bridge', () => {
      vi.stubGlobal('webkit', { messageHandlers: {} })
      expect(isEmbeddedWebView('')).toBe(true)
    })

    it('detects ReactNativeWebView bridge', () => {
      vi.stubGlobal('ReactNativeWebView', { postMessage: vi.fn() })
      expect(isEmbeddedWebView('')).toBe(true)
    })

    it.for([
      [
        'Chrome',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/145.0.7000.0 Mobile/15E148 Safari/604.1'
      ],
      [
        'Chrome in desktop mode',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/85 Version/11.1.1 Safari/605.1.15'
      ],
      [
        'Safari',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      ],
      [
        'Firefox',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1'
      ],
      [
        'Edge',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1'
      ],
      [
        'Opera',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 OPiOS/16.0.14 Mobile/15E148 Safari/9537.53'
      ],
      [
        'iPadOS Safari in desktop mode',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      ]
    ] as const)(
      ([browser]: readonly [string, string]) =>
        `ignores webkit.messageHandlers in ${browser}`,
      ([, ua]: readonly [string, string]) => {
        vi.stubGlobal('webkit', { messageHandlers: {} })
        expect(isEmbeddedWebView(ua)).toBe(false)
      }
    )

    it('detects webkit.messageHandlers in a macOS Safari-shaped host', () => {
      vi.stubGlobal('webkit', { messageHandlers: {} })
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })

    it('detects ReactNativeWebView when the UA looks like Chrome on iOS', () => {
      vi.stubGlobal('ReactNativeWebView', { postMessage: vi.fn() })
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'
      expect(isEmbeddedWebView(ua)).toBe(true)
    })
  })
})
