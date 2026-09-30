import { describe, expect, it } from 'vitest'

import { hasKey, t } from '../i18n/translations'
import { deriveSections } from './contentSections'

describe('deriveSections', () => {
  it('lists the numbered Terms of Service sections in number order', () => {
    const titleNumbers = deriveSections('tos')
      .map((section) => `tos.${section.id}.title`)
      .filter(hasKey)
      .map((key) => parseInt(t(key)))

    expect(titleNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })
})
