import { describe, expect, it } from 'vitest'

import { translationKeys } from '../../translations'
import { approvedLayer } from '../source'
import { translationsAdapter } from './translations'

describe('translationsAdapter', () => {
  const entries = translationsAdapter.read()

  it('reads every key in translations.ts', () => {
    expect(translationsAdapter.name).toBe('translations')
    expect(entries).toHaveLength(translationKeys.length)
  })

  /**
   * An empty English string is deliberate, not missing. `translations.ts` splits
   * one heading into two fragments so each language can order it its own way:
   *
   *   heroTitle.before   en: '{name} in'   zh-CN: ''
   *   heroTitle.after    en: ''            zh-CN: ' 中的 {name}'
   *
   * English renders "{name} in X", Chinese renders "X 中的 {name}". Whichever
   * fragment a language does not need is blanked.
   *
   * This is the only such pair in the file, and it is pinned here so that if a
   * second one appears someone has to look at it: a per-key pipeline cannot
   * translate this shape, because the split itself is language-specific and the
   * model cannot move content between two independent keys.
   */
  it('exposes empty English only for the known word-order fragment', () => {
    const empty = entries.filter((entry) => entry.english.trim() === '')
    expect(empty.map((entry) => entry.key)).toEqual([
      'models.list.heroTitle.after'
    ])
  })

  /**
   * Chinese is complete today, and that is the fact the whole zero-diff promise
   * rests on: if the adapter reported any of these as missing, the model would
   * translate over approved work.
   */
  it('treats the existing Chinese as approved, for every key', () => {
    const approved = approvedLayer(entries, 'zh-CN')
    expect(Object.keys(approved)).toHaveLength(translationKeys.length)
  })

  it('reports Japanese only where a person actually wrote it', () => {
    const approved = approvedLayer(entries, 'ja')
    // Japanese is barely started, so this must be a small non-zero subset. The
    // day it equals the key count, Japanese is done by hand and the pipeline has
    // nothing left to fill.
    expect(Object.keys(approved).length).toBeGreaterThan(0)
    expect(Object.keys(approved).length).toBeLessThan(translationKeys.length)
  })

  it('does not invent an approved value for the default locale', () => {
    // English is the source, not a translation. Listing it as approved would let
    // it be treated as a layer that can win over itself.
    for (const entry of entries) {
      expect(entry.approved).not.toHaveProperty('en')
    }
  })
})
