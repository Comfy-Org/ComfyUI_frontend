import { describe, expect, it } from 'vitest'

import { resolveFaqPairs } from './faqPairs'

const item = {
  id: 'what-is-ltx',
  question: { en: 'What is LTX-2.5?', ja: 'LTX-2.5とは？' },
  answer: { en: 'The newest version.' }
}

describe('resolveFaqPairs', () => {
  /**
   * The defect this exists for. `/ja/ltx-2.5` published a Japanese question
   * above an English answer, in the visible section and again in the FAQPage
   * JSON-LD, because each half fell back on its own.
   */
  it('drops a translated question whose answer is untranslated', () => {
    expect(resolveFaqPairs([item], 'ja')).toEqual([
      {
        id: 'what-is-ltx',
        question: 'What is LTX-2.5?',
        answer: 'The newest version.'
      }
    ])
  })

  it('uses the locale when both halves are translated', () => {
    const translated = {
      ...item,
      answer: { en: item.answer.en, ja: '最新版です。' }
    }

    expect(resolveFaqPairs([translated], 'ja')).toEqual([
      { id: 'what-is-ltx', question: 'LTX-2.5とは？', answer: '最新版です。' }
    ])
  })

  it('leaves English alone', () => {
    expect(resolveFaqPairs([item], 'en')).toEqual([
      {
        id: 'what-is-ltx',
        question: 'What is LTX-2.5?',
        answer: 'The newest version.'
      }
    ])
  })
})
