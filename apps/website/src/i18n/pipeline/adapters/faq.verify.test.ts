import { describe, expect, it } from 'vitest'

import { buildFaqDocument, parseFaqDocument, verifyFaqDocument } from './faq'

const ENGLISH = parseFaqDocument(
  'enterprise/en/how-do-we-get-started',
  `---
question: "How do we get started?"
order: 2
---

[Tell us](/contact) what you want to build, then read the
[FDC page](/forward-deployed-creatives).
`
)

/**
 * What stands between a translation run and 26 new files a reader will see.
 * Every case here hands it a document that is wrong in a different way.
 */
describe('verifyFaqDocument', () => {
  const good = (question: string, body: string) =>
    buildFaqDocument(ENGLISH, { question, body })

  it('passes a faithful translation', () => {
    const built = good(
      '始めるにはどうすればよいですか？',
      '[お問い合わせ](/contact)ください。[FDC ページ](/forward-deployed-creatives)もご覧ください。'
    )

    expect(verifyFaqDocument(ENGLISH, built)).toEqual([])
  })

  it('catches a link the translation dropped', () => {
    const built = good('始めるには？', 'お問い合わせください。')

    expect(verifyFaqDocument(ENGLISH, built).join(' ')).toContain('/contact')
  })

  it('points a link at the locale path when the locale serves that route', () => {
    // Japanese publishes /pricing. Preserving the link verbatim would send a
    // Japanese reader to the English pricing page; the writer localizes it.
    const withPricing = parseFaqDocument(
      'pricing/en/plans',
      [
        '---',
        'question: "Which plan?"',
        'order: 1',
        '---',
        '',
        'See [pricing](/pricing) and [contact](/contact).',
        ''
      ].join('\n')
    )
    const built = buildFaqDocument(withPricing, {
      question: 'どのプラン？',
      body: '[料金](/pricing)と[お問い合わせ](/contact)をご覧ください。'
    })

    expect(built).toContain('](/ja/pricing)')
    expect(built).toContain('](/contact)')
    expect(verifyFaqDocument(withPricing, built)).toEqual([])
  })

  it('catches a link target the translation rewrote', () => {
    // The tempting mistake: prefixing the locale. `/contact` is not published
    // in Japanese, so `localizeHref` leaves it alone and the link must too.
    const built = good(
      '始めるには？',
      '[お問い合わせ](/ja/contact)ください。[FDC](/forward-deployed-creatives)'
    )

    expect(verifyFaqDocument(ENGLISH, built).join(' ')).toContain('/ja/contact')
  })

  it('catches an order that drifted from the English', () => {
    const built = good(
      '始めるには？',
      '[お問い合わせ](/contact) [FDC](/forward-deployed-creatives)'
    )
    const drifted = built.replace('order: 2', 'order: 7')

    expect(verifyFaqDocument(ENGLISH, drifted).join(' ')).toContain('order')
  })

  it('catches a missing provenance marker', () => {
    const built = good(
      '始めるには？',
      '[お問い合わせ](/contact) [FDC](/forward-deployed-creatives)'
    )
    const unmarked = built.replace('translatedBy: machine\n', '')

    expect(verifyFaqDocument(ENGLISH, unmarked).join(' ')).toContain('machine')
  })

  it('catches an answer left in English', () => {
    const built = good(
      'How do we get started?',
      '[Tell us](/contact) [FDC](/forward-deployed-creatives)'
    )

    expect(verifyFaqDocument(ENGLISH, built).join(' ')).toContain('English')
  })
})
