import { describe, expect, it } from 'vitest'

import { t, tAround, tPlural, translationKeys } from './translations'

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

describe('t() fallback semantics', () => {
  it('returns Japanese copy when it exists', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
  })

  it('falls back to English when Japanese copy is missing', () => {
    expect(t('tags.partnerNodes', 'ja')).toBe('Partner Nodes')
  })
})

describe('t() named values', () => {
  it('interpolates named values in the locale word order', () => {
    expect(
      t('models.list.heroTitle', 'zh-CN', { name: 'Flux', brand: 'ComfyUI' })
    ).toBe('ComfyUI 中的 Flux')
  })

  it('fills every occurrence of a repeated placeholder', () => {
    const message = t('models.faq.whatIs.localAnswer', 'en', {
      name: 'Flux',
      description: 'a model',
      count: 3
    })

    expect(message.match(/Flux/g)).toHaveLength(3)
    expect(message).not.toMatch(/\{\w+\}/)
  })

  it('keeps missing named values visible', () => {
    expect(t('validation.minLength', 'en')).toBe(
      'Must be at least {length} characters'
    )
  })

  it('inserts values literally', () => {
    expect(t('validation.minLength', 'en', { length: '$&' })).toBe(
      'Must be at least $& characters'
    )
  })
})

describe('tPlural', () => {
  it.for([
    [1, '1 node'],
    [3, '3 nodes']
  ] as const)('renders count %s', ([count, expected]) => {
    expect(tPlural('cloudNodesLaunch.models.nodeCount', count, 'en')).toBe(
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

  it.for([
    {
      key: 'models.faq.whatIs.localAnswer',
      slot: 'name',
      error: 'repeats slot {name}'
    },
    {
      key: 'models.list.heroTitle',
      slot: 'creators',
      error: 'missing slot {creators}'
    }
  ] as const)(
    'throws "$error" for a slot that is not in the message exactly once',
    ({ key, slot, error }) => {
      expect(() =>
        tAround(key, 'en', slot, { description: 'a model', count: 3 })
      ).toThrow(error)
    }
  )
})
