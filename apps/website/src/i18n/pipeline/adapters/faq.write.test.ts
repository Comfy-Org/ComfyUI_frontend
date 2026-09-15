import { describe, expect, it } from 'vitest'

import { buildFaqDocument, parseFaqDocument } from './faq'

const ENGLISH = parseFaqDocument(
  'pricing/en/byok',
  `---
question: "Does Comfy support BYOK?"
order: 15
---

Yes. We support **BYOK** today. [Ask us](/contact) and we will set it up.
`
)

/**
 * A generated answer is a whole new file rather than an edit, so the risk is
 * not corruption but drift: an `order` that no longer matches the English, a
 * missing marker that makes the file look hand-written, or a question that
 * breaks its own frontmatter.
 */
describe('buildFaqDocument', () => {
  const built = buildFaqDocument(ENGLISH, {
    question: 'Comfy は BYOK に対応していますか？',
    body: 'はい。本日より **BYOK** に対応しています。[お問い合わせ](/contact)ください。'
  })

  it('reads back as the answer it was given', () => {
    const parsed = parseFaqDocument('pricing/ja/byok', built)

    expect(parsed.question).toBe('Comfy は BYOK に対応していますか？')
    expect(parsed.body.trim()).toBe(
      'はい。本日より **BYOK** に対応しています。[お問い合わせ](/contact)ください。'
    )
  })

  it('carries the English order across, so the sequence cannot drift', () => {
    expect(built).toContain('order: 15')
  })

  it('marks itself as machine-written', () => {
    expect(parseFaqDocument('pricing/ja/byok', built).machineWritten).toBe(true)
  })

  it('escapes a quote in the question rather than breaking the frontmatter', () => {
    const quoted = buildFaqDocument(ENGLISH, {
      question: 'What is a "workflow"?',
      body: 'A graph.'
    })

    expect(parseFaqDocument('pricing/ja/x', quoted).question).toBe(
      'What is a "workflow"?'
    )
  })

  it('ends with exactly one newline', () => {
    // Every hand-written file does, and a stray blank line would show up as a
    // diff on every regeneration.
    expect(built.endsWith('\n')).toBe(true)
    expect(built.endsWith('\n\n')).toBe(false)
  })
})
