import { describe, expect, it } from 'vitest'

import { enforceTranslations, isSystemicFailure } from './enforce'
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

/**
 * Refusing a whole run is a separate decision from dropping a bad translation.
 *
 * Every failing string is already pruned to English individually, so this only
 * decides whether to ALSO reject the keys that passed. The danger it names,
 * reverting a locale to English, needs scale to be real.
 *
 * A share alone cannot tell the difference. A handful of keys fail every run by
 * their nature: a person's name, a domain, a brand in capitals. The model
 * returns them unchanged, which is correct, and the script check drops them for
 * having no Japanese in them. Once the bulk of a locale is translated every run
 * is small, so those few become most of it, and a share-only rule would refuse
 * every nightly run from then on.
 */
describe('isSystemicFailure', () => {
  it('refuses a large run that mostly failed', () => {
    expect(isSystemicFailure({ dropped: 400, total: 500 })).toBe(true)
  })

  it('allows a large run with a weak tail', () => {
    expect(isSystemicFailure({ dropped: 40, total: 500 })).toBe(false)
  })

  /**
   * The hub sets this at 0.15 and calls anything above it systemic rather than
   * a weak tail. Ours sat at 0.5, which would have published a run that reverted
   * a third of a locale to English without complaining.
   */
  it('refuses a run that lost a fifth of its keys', () => {
    expect(isSystemicFailure({ dropped: 100, total: 500 })).toBe(true)
  })

  it('allows a small run even when nearly all of it failed', () => {
    // The real case: nine chronic failures and one good new key. Refusing here
    // discarded a correct translation and published nothing.
    expect(isSystemicFailure({ dropped: 9, total: 10 })).toBe(false)
  })

  it('still refuses once the damage is large in absolute terms', () => {
    expect(isSystemicFailure({ dropped: 21, total: 30 })).toBe(true)
  })

  it('treats an empty run as nothing to refuse', () => {
    expect(isSystemicFailure({ dropped: 0, total: 0 })).toBe(false)
  })
})
