import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, st, stRaw } from './i18n'

const TEST_NAMESPACE = 'safeTranslationTest'

beforeEach(() => {
  i18n.global.locale.value = 'en'
  const messages = i18n.global.getLocaleMessage('en')
  delete (messages as Record<string, unknown>)[TEST_NAMESPACE]
  i18n.global.setLocaleMessage('en', messages)
})

describe('st', () => {
  it('returns the fallback when the key is not found', () => {
    expect(st('safeTranslationTest.missing', 'Fallback value')).toBe(
      'Fallback value'
    )
  })

  it('uses compiled translations for valid locale messages', () => {
    i18n.global.mergeLocaleMessage('en', {
      safeTranslationTest: {
        valid: 'Translated value'
      }
    })

    expect(st('safeTranslationTest.valid', 'Fallback value')).toBe(
      'Translated value'
    )
  })

  it('returns raw locale messages when vue-i18n compilation fails', () => {
    const message = 'Provided by @acme/model with JSON such as {"mode":"fast"}'

    i18n.global.mergeLocaleMessage('en', {
      safeTranslationTest: {
        invalidLinkedFormat: message
      }
    })

    expect(
      st('safeTranslationTest.invalidLinkedFormat', 'Fallback value')
    ).toBe(message)
  })
})

describe('stRaw', () => {
  it('returns raw locale messages for valid keys', () => {
    i18n.global.mergeLocaleMessage('en', {
      safeTranslationTest: {
        rawValue: 'Raw value'
      }
    })

    expect(stRaw('safeTranslationTest.rawValue', 'Fallback value')).toBe(
      'Raw value'
    )
  })

  it('returns raw messages containing vue-i18n syntax', () => {
    const message = 'Provided by @acme/model with JSON such as {"mode":"fast"}'

    i18n.global.mergeLocaleMessage('en', {
      safeTranslationTest: {
        rawSyntax: message
      }
    })

    expect(stRaw('safeTranslationTest.rawSyntax', 'Fallback value')).toBe(
      message
    )
  })

  it('returns the fallback when the key is not found', () => {
    expect(stRaw('safeTranslationTest.rawMissing', 'Fallback value')).toBe(
      'Fallback value'
    )
  })
})

// Guards patches/@intlify__shared: its unbounded attribute-name regex goes
// quadratic (and overflows Firefox's regex engine) on a long word run when the
// quote it wants is missing, and a rescan bug makes sanitizeStyleValue O(n^2).
// The assertions are on output size and content, not wall-clock, so they fail
// deterministically if the patch is dropped — Vitest's fake timers would make a
// timing assertion inert here.
describe('the HTML sanitizer stays linear and correct', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  const translate = (message: string) => {
    i18n.global.mergeLocaleMessage('en', {
      safeTranslationTest: { sanitize: message }
    })
    return i18n.global.t('safeTranslationTest.sanitize')
  }

  it('handles a long attribute-name run in both quote passes', () => {
    // Ends in a single quote so the double-quote pass keeps retrying the run —
    // the quadratic case; the unbounded regex hangs, the bounded one returns.
    expect(() => translate(`<a ${'x'.repeat(500_000)}='y'>`)).not.toThrow()
    expect(translate(`<a ${'x'.repeat(500_000)}="y">`)).toContain('="y"')
  })

  it('neutralizes a javascript: url after and abutting a long name', () => {
    expect(
      translate(`<a ${'x'.repeat(200)}="1" href="javascript:alert(1)">`)
    ).toContain('href="about:blank"')
    // no separator before href — the boundary is not consumed
    expect(translate('<a x="1"href="javascript:alert(1)">')).toContain(
      'href="about:blank"'
    )
    expect(translate("<a x='1'href='javascript:alert(1)'>")).toContain(
      "href='about:blank'"
    )
  })

  it('escapes the value of an over-length attribute name', () => {
    expect(translate(`${'a'.repeat(101)}="<img>"`)).toContain('&lt;img&gt;')
    // the long name's unescaped quotes must not re-pair and smuggle href through
    expect(
      translate(`<a ${'L'.repeat(101)}="a x=' q" href='javascript:alert(1)'>`)
    ).toContain("href='about:blank'")
  })

  it('keeps sanitizeStyleValue single-pass on nested url()', () => {
    const k = 5_000
    // The unpatched rescan re-appends every processed span, so the output blows
    // up to tens of MB; the fixed single pass stays near the input size.
    const out = translate(`<a style="${'url('.repeat(k)}${')'.repeat(k)}">`)
    expect(out.length).toBeLessThan(200_000)
    // a sibling url() after a processed one is still scanned and neutralized
    expect(
      translate('<a style="background:url(a) url(javascript:alert(1))">')
    ).toContain('url(about:blank)')
  })
})
