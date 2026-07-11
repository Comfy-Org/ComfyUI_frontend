import { beforeEach, describe, expect, it } from 'vitest'

import { i18n, st } from './i18n'

describe('st', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
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
    const message =
      'Provided by @acme/model with JSON such as {"mode":"fast"}'

    i18n.global.mergeLocaleMessage('en', {
      safeTranslationTest: {
        invalidLinkedFormat: message
      }
    })

    expect(st('safeTranslationTest.invalidLinkedFormat', 'Fallback value')).toBe(
      message
    )
  })
})
