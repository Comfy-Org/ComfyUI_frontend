import { describe, expect, it } from 'vitest'

import machineZhCN from './content/zh-CN.json'
import { localizedEntry, resolveTranslation, translationKeys } from './source'
import { t } from './translations'

/**
 * The promise this whole pipeline is built around.
 *
 * The approved Chinese was written and signed off by native reviewers and those
 * pages rank, so a translation run must never alter what a Chinese reader sees.
 * That is guaranteed structurally rather than by convention: `translations.ts`
 * holds the approved copy and nothing in the pipeline writes to it.
 *
 * These tests assert the guarantee from the outside, at the only place it can
 * actually be broken: the resolver. If the machine layer could ever shadow an
 * approved string, this file fails.
 */
describe('approved Chinese is never overwritten', () => {
  it('serves the approved string for every key that has one', () => {
    const shadowed: string[] = []
    for (const key of translationKeys) {
      const approved = localizedEntry(key)['zh-CN']
      if (approved === undefined) continue
      if (t(key, 'zh-CN') !== approved) shadowed.push(key)
    }
    expect(
      shadowed,
      'the machine layer shadowed an approved Chinese string'
    ).toEqual([])
  })

  it('reports every one of them as approved, never as machine', () => {
    const wrong = translationKeys.filter(
      (key) =>
        localizedEntry(key)['zh-CN'] !== undefined &&
        resolveTranslation(key, 'zh-CN').provenance !== 'approved'
    )
    expect(wrong).toEqual([])
  })

  /**
   * A ratchet, not a completeness requirement.
   *
   * Chinese is no longer a required field: the hub does not require translations
   * to exist either, and demanding them here is what stopped anyone adding
   * English copy without hand-writing Chinese, which in turn meant the pipeline
   * never had a Chinese gap to fill.
   *
   * So adding an English-only key is fine and must stay fine. What must not
   * happen is losing Chinese that already exists. Counting rather than requiring
   * full coverage allows the first and catches the second.
   *
   * Raise the floor when Chinese grows. Never lower it without saying why.
   */
  it('never loses approved Chinese that already exists', () => {
    // 2116 -> 2147 (P3-3) -> 2167 (P3-4), rescuing 51 Chinese strings that had
    // been typed into zh-CN page files where no pipeline could see them. No
    // zh-CN page file holds a Chinese character any more.
    const APPROVED_CHINESE_FLOOR = 2167
    const covered = translationKeys.filter(
      (key) => localizedEntry(key)['zh-CN'] !== undefined
    ).length
    expect(
      covered,
      `approved Chinese dropped from ${APPROVED_CHINESE_FLOOR} to ${covered}. ` +
        `Adding an English-only key is fine and does not change this number; ` +
        `losing a Chinese string does.`
    ).toBeGreaterThanOrEqual(APPROVED_CHINESE_FLOOR)
  })

  /**
   * The machine layer being empty is the current state, not a requirement. What
   * matters is that whatever it holds cannot win: this asserts every key it
   * does contain is one the approved layer does NOT cover, so the two can never
   * disagree about a string a reader sees.
   */
  it('never holds a machine translation for a key Chinese already has', () => {
    const shadowing = Object.keys(machineZhCN).filter(
      (key) =>
        translationKeys.includes(key as never) &&
        localizedEntry(key as never)['zh-CN'] !== undefined
    )
    expect(
      shadowing,
      'these machine translations can never be displayed; the source build should not have requested them'
    ).toEqual([])
  })
})
