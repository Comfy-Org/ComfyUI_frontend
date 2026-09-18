import { describe, expect, it, vi } from 'vitest'

import type { Locale, TranslationKey } from '../i18n/translations'
import { deriveSections } from './contentSections'

vi.mock(import('../i18n/translations'), () => {
  const chinese = {
    'privacy.intro.label': '介绍',
    'privacy.intro.block.2': '第一项\n第二项',
    'privacy.intro.block.0': '段落',
    'privacy.personal-information.label': '个人信息',
    'privacy.personal-information.title': '标题',
    'privacy.personal-information.block.0': '内容',
    'enterprise.minimaxBand.label': '其他'
  } satisfies Partial<Record<TranslationKey, string>>

  function hasKey(key: string): key is keyof typeof chinese {
    return key in chinese
  }

  return {
    translationKeys: Object.keys(chinese).filter(hasKey),
    hasKey,
    t(key: TranslationKey, locale: Locale = 'en') {
      if (locale !== 'zh-CN')
        throw new Error(`Dictionary unavailable: ${locale}`)
      if (!hasKey(key)) throw new Error(`Unknown translation: ${key}`)
      return chinese[key]
    }
  }
})

describe('deriveSections with only the page dictionary available', () => {
  it('derives ordered sections and block types from the Chinese dictionary', () => {
    expect(deriveSections('privacy', 'zh-CN')).toEqual([
      {
        id: 'intro',
        hasTitle: false,
        blocks: [{ type: 'paragraph' }, { type: 'list' }]
      },
      {
        id: 'personal-information',
        hasTitle: true,
        blocks: [{ type: 'paragraph' }]
      }
    ])
  })

  it('returns no sections for an unknown prefix', () => {
    expect(deriveSections('missing', 'zh-CN')).toEqual([])
  })
})
