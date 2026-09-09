import { describe, expect, it } from 'vitest'

import { withEnglishFallback } from './englishFallback'

/** A stand-in for `getCollection`, so the decision is testable without Astro. */
const collection = (byLocale: Record<string, string[]>) => {
  const calls: string[] = []
  const load = async (code: string) => {
    calls.push(code)
    return byLocale[code] ?? []
  }
  return { load, calls }
}

describe('withEnglishFallback', () => {
  it('uses the locale that has entries', async () => {
    const { load, calls } = collection({ en: ['a'], 'zh-CN': ['甲'] })

    expect(await withEnglishFallback('zh-CN', load)).toEqual(['甲'])
    expect(calls).toEqual(['zh-CN'])
  })

  /**
   * The defect this exists for, in both of its shapes. The FAQ collection and
   * the customer-story collection each hold `en` and `zh-CN` only, so once one
   * page file served every language, `/ja/pricing` rendered the FAQ heading
   * with all 21 questions gone and `/ja/customers` built a listing page with no
   * listings on it. Missing content is worse than English content, because the
   * reader cannot tell it was ever there.
   */
  it('falls back to English when the locale has none', async () => {
    const { load, calls } = collection({ en: ['a', 'b'] })

    expect(await withEnglishFallback('ja', load)).toEqual(['a', 'b'])
    expect(calls).toEqual(['ja', 'en'])
  })

  /**
   * English asking for English must not load twice, and an empty English
   * collection is a real answer: there is nothing further to fall back to.
   */
  it('does not fall back when English itself is empty', async () => {
    const { load, calls } = collection({})

    expect(await withEnglishFallback('en', load)).toEqual([])
    expect(calls).toEqual(['en'])
  })

  /** The fallback is allowed to come back empty rather than loop or throw. */
  it('returns nothing when neither the locale nor English has entries', async () => {
    const { load, calls } = collection({ 'zh-CN': ['甲'] })

    expect(await withEnglishFallback('ja', load)).toEqual([])
    expect(calls).toEqual(['ja', 'en'])
  })
})
