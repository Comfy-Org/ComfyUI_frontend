import { describe, expect, it } from 'vitest'

import { affiliateFaqPageNode } from './_faqJsonLd'

const faqs = [
  {
    id: 'tracking',
    question: { en: 'How do I track referrals?', 'zh-CN': '如何追踪推荐？' },
    answer: { en: 'A real-time dashboard.', 'zh-CN': '实时仪表盘。' }
  }
]

const questions = (node: ReturnType<typeof affiliateFaqPageNode>) =>
  node.mainEntity as { name: string; acceptedAnswer: { text: string } }[]

describe('affiliateFaqPageNode', () => {
  it('anchors the node to the canonical URL', () => {
    const node = affiliateFaqPageNode(
      'https://comfy.org/affiliates/',
      faqs,
      'en'
    )

    expect(node['@id']).toBe('https://comfy.org/affiliates/#faq')
  })

  it('uses the locale when the item is translated', () => {
    const [first] = questions(
      affiliateFaqPageNode('https://comfy.org/affiliates/', faqs, 'zh-CN')
    )

    expect(first.name).toBe('如何追踪推荐？')
    expect(first.acceptedAnswer.text).toBe('实时仪表盘。')
  })

  /**
   * The page used to index question and answer separately, so a locale holding
   * one half would have emitted `name: undefined` into structured data rather
   * than failing. Every affiliate FAQ carries all three locales today, which is
   * exactly what kept it invisible.
   */
  it('falls back as a unit rather than pairing two languages', () => {
    const halfTranslated = [{ ...faqs[0], answer: { en: faqs[0].answer.en } }]

    const [first] = questions(
      affiliateFaqPageNode(
        'https://comfy.org/affiliates/',
        halfTranslated,
        'zh-CN'
      )
    )

    expect(first.name).toBe('How do I track referrals?')
    expect(first.acceptedAnswer.text).toBe('A real-time dashboard.')
  })

  it('never emits an undefined question', () => {
    const node = affiliateFaqPageNode(
      'https://comfy.org/affiliates/',
      faqs,
      'ja'
    )

    for (const entry of questions(node)) {
      expect(entry.name).toBeTruthy()
      expect(entry.acceptedAnswer.text).toBeTruthy()
    }
  })
})
