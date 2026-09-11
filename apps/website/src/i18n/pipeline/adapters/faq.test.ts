import { describe, expect, it } from 'vitest'

import { entriesFromFaq, faqAdapter, parseFaqDocument } from './faq'

const FILE = `---
question: "Does Comfy support BYOK?"
order: 15
---

Yes. We support **BYOK** today. [Ask us](/contact) and we will set it up.
`

describe('parseFaqDocument', () => {
  it('separates the question, the body and the raw frontmatter', () => {
    const doc = parseFaqDocument('pricing/en/byok', FILE)

    expect(doc.question).toBe('Does Comfy support BYOK?')
    expect(doc.body.trim()).toBe(
      'Yes. We support **BYOK** today. [Ask us](/contact) and we will set it up.'
    )
    // Kept raw so a writer can reproduce `order` without re-serialising it.
    expect(doc.frontmatter).toContain('order: 15')
  })

  it('reads the category, locale and slug out of the id', () => {
    const doc = parseFaqDocument('pricing/zh-CN/byok-provider-keys', FILE)

    expect(doc.category).toBe('pricing')
    expect(doc.locale).toBe('zh-CN')
    expect(doc.slug).toBe('byok-provider-keys')
  })

  it('notices the pipeline wrote it', () => {
    const generated = FILE.replace(
      'order: 15',
      'order: 15\ntranslatedBy: machine'
    )

    expect(parseFaqDocument('pricing/ja/byok', generated).machineWritten).toBe(
      true
    )
    expect(parseFaqDocument('pricing/en/byok', FILE).machineWritten).toBe(false)
  })

  it('refuses a file with no frontmatter rather than guessing', () => {
    expect(() => parseFaqDocument('pricing/en/x', 'just prose')).toThrow(
      /frontmatter/
    )
  })
})

describe('entriesFromFaq', () => {
  const english = parseFaqDocument('pricing/en/byok', FILE)
  const chinese = parseFaqDocument(
    'pricing/zh-CN/byok',
    `---
question: "Comfy 支持 BYOK 吗？"
order: 15
---

可以。我们今天就支持 **BYOK**。
`
  )

  it('makes two keys per answer, from the English file', () => {
    expect(entriesFromFaq([english]).map((entry) => entry.key)).toEqual([
      'faq.pricing.byok.question',
      'faq.pricing.byok.body'
    ])
  })

  it('treats a translation a person wrote as approved', () => {
    const entries = entriesFromFaq([english, chinese])
    const question = entries.find((e) => e.key.endsWith('.question'))

    expect(question?.english).toBe('Does Comfy support BYOK?')
    expect(question?.approved['zh-CN']).toBe('Comfy 支持 BYOK 吗？')
  })

  it('does not treat its own output as approved', () => {
    // Otherwise the answer freezes: approved values are never re-sent, so a
    // later English edit could never reach the Japanese file.
    const generated = parseFaqDocument(
      'pricing/ja/byok',
      `---
question: "Comfy は BYOK に対応していますか？"
order: 15
translatedBy: machine
---

はい。
`
    )
    const entries = entriesFromFaq([english, generated])

    expect(entries.every((entry) => entry.approved.ja === undefined)).toBe(true)
  })

  it('ignores a translation with no English original', () => {
    expect(entriesFromFaq([chinese])).toEqual([])
  })
})

describe('the faq adapter over src/content/faq', () => {
  const entries = faqAdapter.read()

  it('finds two keys for every English answer', () => {
    // 21 pricing + 5 enterprise, question and body each.
    expect(entries.length).toBe(52)
  })

  it('gives every entry a unique key', () => {
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length)
  })

  it('has Chinese for every one of them', () => {
    expect(entries.filter((e) => e.approved['zh-CN']).length).toBe(
      entries.length
    )
  })

  it('never emits an entry with nothing to translate', () => {
    expect(entries.filter((e) => e.english.trim() === '')).toEqual([])
  })
})
