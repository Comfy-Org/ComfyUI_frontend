import { beforeEach, describe, expect, it } from 'vitest'

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
