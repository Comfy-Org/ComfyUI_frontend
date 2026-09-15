import { describe, expect, it } from 'vitest'

import { LOCALIZED_CODES } from '../../src/config/locales'
import { localeRubric, parsePreserveTerms } from './config'

/**
 * The glossary is injected into the translation prompt and is also what the
 * page-coverage gate treats as legitimately-English text. `as string[]` asserted
 * a shape nobody checked, so a wrong-shaped file surfaced far from its cause:
 * `{}` reached `.join()` inside a paid translation job, and a non-string entry
 * reached `comparePage()` during a CI gate.
 */
describe('parsePreserveTerms', () => {
  const FILE = 'preserve-terms.json'

  it('reads a list of terms', () => {
    expect(parsePreserveTerms('["ComfyUI", "LoRA"]', FILE)).toEqual([
      'ComfyUI',
      'LoRA'
    ])
  })

  it('rejects an object', () => {
    expect(() => parsePreserveTerms('{}', FILE)).toThrow(/must be a JSON array/)
  })

  it('rejects a non-string entry', () => {
    expect(() => parsePreserveTerms('["ComfyUI", 7]', FILE)).toThrow(
      /entry 1 is not a string/
    )
  })

  it('names the file it could not parse', () => {
    expect(() => parsePreserveTerms('not json', FILE)).toThrow(/preserve-terms/)
  })
})

/**
 * The shared `OutputLocale` type makes `guidance` optional, because the app UI's
 * locales have none. On the website it is not optional: it is half of what the
 * translator is told, and half of the rubric the reviewer's verdicts are
 * fingerprinted against. A locale silently missing it would be translated to no
 * particular voice and reviewed against no particular standard.
 */
describe('localeRubric', () => {
  it('carries a name and voice guidance for every locale the site serves', () => {
    for (const locale of LOCALIZED_CODES) {
      const rubric = localeRubric(locale)
      expect(rubric.name).not.toBe('')
      expect(rubric.guidance.trim()).not.toBe('')
    }
  })

  it('refuses a locale the pipeline does not translate', () => {
    expect(() => localeRubric('en')).toThrow(/OUTPUT_LOCALES/)
  })
})
