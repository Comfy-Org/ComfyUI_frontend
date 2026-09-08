import { describe, expect, it } from 'vitest'

import { parsePreserveTerms } from './config'

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
