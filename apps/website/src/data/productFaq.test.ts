import { describe, expect, it } from 'vitest'

import { productFaqItems } from './productFaq'

describe('productFaqItems', () => {
  it.each([
    ['cloud.faq', 12],
    ['download.faq', 8]
  ])('flattens every %s entry', (prefix, count) => {
    const items = productFaqItems(prefix, count, 'en')
    expect(items).toHaveLength(count)
    for (const item of items) {
      expect(item.question).toBeTruthy()
      expect(item.answer).toBeTruthy()
    }
  })

  it('strips HTML anchors down to their text', () => {
    const answers = productFaqItems('cloud.faq', 12, 'en').map(
      (item) => item.answer
    )
    for (const answer of answers) {
      expect(answer).not.toMatch(/<[a-z]/i)
      expect(answer).not.toContain('\n')
    }
    expect(answers[11]).toContain('Pricing FAQs')
  })

  it('resolves zh-CN strings', () => {
    const items = productFaqItems('cloud.faq', 12, 'zh-CN')
    expect(items[0].question).not.toEqual(
      productFaqItems('cloud.faq', 12, 'en')[0].question
    )
  })
})
