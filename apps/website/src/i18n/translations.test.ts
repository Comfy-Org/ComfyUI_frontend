import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '../config/locales'
import { hasKey, t, tAround, translationKeys } from './translations'

describe('translation keys', () => {
  it('never uses a key as the prefix of another key', () => {
    const keys = new Set<string>(translationKeys)
    const collisions = translationKeys.filter((key) => {
      const segments = key.split('.')
      return segments
        .slice(1)
        .some((_, index) => keys.has(segments.slice(0, index + 1).join('.')))
    })
    expect(collisions).toEqual([])
  })
})

describe('t()', () => {
  it('returns Japanese copy when it exists', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
  })

  it('falls back to English when Japanese copy is missing', () => {
    expect(t('tags.partnerNodes', 'ja')).toBe('Partner Nodes')
  })

  it('interpolates named values in the locale word order', () => {
    expect(
      t('models.list.heroTitle', 'zh-CN', { name: 'Flux', brand: 'ComfyUI' })
    ).toBe('ComfyUI 中的 Flux')
  })

  it('renders escaped special characters literally', () => {
    expect(t('auth.errors.signupBlocked')).toContain('support@comfy.org')
  })

  it.for(LOCALE_CODES)('compiles every %s message', (locale) => {
    const failing = translationKeys.filter((key) => {
      try {
        t(key, locale)
        return false
      } catch {
        return true
      }
    })
    expect(failing).toEqual([])
  })
})

describe('tAround', () => {
  it.for([
    { locale: 'en', parts: ['Flux in ', ''] },
    { locale: 'zh-CN', parts: ['', ' 中的 Flux'] }
  ] as const)(
    'splits the $locale message around the slot',
    ({ locale, parts }) => {
      expect(
        tAround('models.list.heroTitle', locale, 'brand', { name: 'Flux' })
      ).toEqual(parts)
    }
  )
})

describe('hasKey', () => {
  it('accepts leaf keys only', () => {
    expect(hasKey('hero.title')).toBe(true)
    expect(hasKey('hero')).toBe(false)
    expect(hasKey('toString')).toBe(false)
  })
})
