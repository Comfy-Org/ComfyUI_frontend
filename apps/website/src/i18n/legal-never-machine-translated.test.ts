import { describe, expect, it } from 'vitest'

import { LOCALIZED_CODES } from '../config/locales'
import machineJa from './content/ja.json'
import machineZhCn from './content/zh-CN.json'
import { translatableEntries } from './pipeline/source'
import { resolveTranslation, translationKeys } from './source'

/**
 * Contracts are never machine-translated.
 *
 * `translatableEntries` is what enforces it, and its own tests cover the filter
 * thoroughly — but only on the way IN, against synthetic keys. What a reader is
 * served is `content/{locale}.json`, and nothing had ever looked at that: both
 * files were empty, so a check would have passed without meaning anything.
 *
 * P4 writes those files for the first time. These tests assert the promise at
 * the two places it can actually break — the shipped artifact and the resolver
 * that reads it — the same way `approved-chinese.test.ts` does for the promise
 * that human Chinese is never overwritten.
 *
 * Approved human translations are deliberately unaffected: the Chinese privacy
 * policy is fully translated and stays that way. The rule is about generated
 * text, not about language.
 */
const excludedKeys = translationKeys.filter(
  (key) =>
    translatableEntries([{ key, english: 'x', approved: {} }]).length === 0
)
const excluded = new Set<string>(excludedKeys)

const machineLayers: Record<string, Record<string, string>> = {
  ja: machineJa,
  'zh-CN': machineZhCn
}

describe('legal copy is never machine-translated', () => {
  it('has excluded keys to check', () => {
    // Six contract namespaces plus two opted-out pages. A filter that silently
    // stopped matching would leave this empty and every assertion below vacuous.
    expect(excluded.size).toBeGreaterThan(400)
  })

  it.each(Object.keys(machineLayers))(
    'keeps them out of the shipped %s machine layer',
    (locale) => {
      // Tested against the namespace rule itself rather than against the
      // excluded set, which is drawn from the source of record: a key that no
      // longer exists there — a rename's leftover — is exactly the one nobody
      // is tracking, and membership testing would wave it through.
      const leaked = Object.keys(machineLayers[locale]).filter(
        (key) =>
          translatableEntries([{ key, english: 'x', approved: {} }]).length ===
          0
      )
      expect(leaked, 'a contract was machine-translated').toEqual([])
    }
  )

  it('never resolves one to a generated string in any locale', () => {
    const generated = excludedKeys.filter((key) =>
      LOCALIZED_CODES.some(
        (locale) => resolveTranslation(key, locale).provenance === 'machine'
      )
    )
    expect(generated, 'a reader was served generated contract text').toEqual([])
  })
})
