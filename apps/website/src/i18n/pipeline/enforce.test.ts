import { describe, expect, it } from 'vitest'

import { enforceTranslations } from './enforce'
import type { Violation } from './validate'

const violation = (key: string): Violation => ({
  key,
  locale: 'ja',
  kind: 'glossary',
  detail: 'test'
})

describe('enforceTranslations', () => {
  /**
   * The mechanism that makes publishing on the AI pass safe. A flagged string is
   * removed, not corrected: the key becomes absent, the resolver falls back to
   * English, and the page shows English rather than a translation the reviewer
   * rejected. Nothing wrong is ever published.
   */
  it('drops a flagged translation instead of publishing it', () => {
    const result = enforceTranslations({ good: 'よい', bad: 'わるい' }, [
      violation('bad')
    ])
    expect(result.kept).toEqual({ good: 'よい' })
    expect(result.dropped).toEqual(['bad'])
  })

  it('keeps everything when nothing was flagged', () => {
    const result = enforceTranslations({ a: 'ア', b: 'イ' }, [])
    expect(result.kept).toEqual({ a: 'ア', b: 'イ' })
    expect(result.dropped).toEqual([])
  })

  it('drops a key once even when it failed several checks', () => {
    const result = enforceTranslations({ a: 'ア' }, [
      violation('a'),
      { ...violation('a'), kind: 'url' }
    ])
    expect(result.dropped).toEqual(['a'])
    expect(result.kept).toEqual({})
  })

  /**
   * Systemic pruning means the model or the config is broken, not that the tail
   * is bad. Publishing a locale that lost most of its translations would quietly
   * revert it to English, so the caller is given the number to act on.
   */
  it('reports the drop rate so a broken run can be told from a bad tail', () => {
    const result = enforceTranslations({ a: 'ア', b: 'イ', c: 'ウ', d: 'エ' }, [
      violation('a'),
      violation('b'),
      violation('c')
    ])
    expect(result.droppedShare).toBeCloseTo(0.75)
  })

  it('reports a zero drop rate for an empty run rather than dividing by zero', () => {
    expect(enforceTranslations({}, []).droppedShare).toBe(0)
  })
})
