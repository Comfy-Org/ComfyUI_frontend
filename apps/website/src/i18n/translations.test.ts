import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '../config/locales'
import { hasKey, t, tAround, tPlural, translationKeys } from './translations'

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

  it('keeps missing named values visible', () => {
    expect(t('validation.minLength', 'en')).toBe(
      'Must be at least {length} characters'
    )
  })

  it('renders escaped special characters literally', () => {
    expect(t('auth.errors.signupBlocked')).toContain('support@comfy.org')
  })

  it('keeps interleaved page locales isolated', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
    expect(t('hero.title', 'en')).toBe('Professional Control\nof Visual AI')
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
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

describe('tPlural', () => {
  it.for([
    ['en', 0, '0 nodes'],
    ['en', 1, '1 node'],
    ['en', 3, '3 nodes'],
    ['ja', 0, '0 nodes'],
    ['ja', 1, '1 node'],
    ['ja', 3, '3 nodes']
  ] as const)('renders %s count %s', ([locale, count, expected]) => {
    expect(tPlural('cloudNodesLaunch.models.nodeCount', count, locale)).toBe(
      expected
    )
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

  it('rejects messages that repeat the markup slot', () => {
    expect(() =>
      tAround('models.faq.whatIs.localAnswer', 'en', 'name', {
        description: 'a model',
        count: 3
      })
    ).toThrow('repeats slot {name}')
  })
})

describe('hasKey', () => {
  it('accepts leaf keys only', () => {
    expect(hasKey('hero.title')).toBe(true)
    expect(hasKey('hero')).toBe(false)
    expect(hasKey('toString')).toBe(false)
  })
})
