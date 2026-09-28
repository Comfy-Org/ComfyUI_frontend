import { describe, expect, it } from 'vitest'

import type { TranslationKey } from '../i18n/translations'
import { t } from '../i18n/translations'
import { deriveSections } from './contentSections'

describe('deriveSections', () => {
  it('lists the numbered Terms of Service sections in number order', () => {
    const titleNumbers = deriveSections('tos')
      .filter((section) => section.hasTitle)
      .map((section) =>
        parseInt(t(`tos.${section.id}.title` as TranslationKey))
      )

    expect(titleNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })
})
