import { describe, expect, it } from 'vitest'

import { parseTranslationLayer } from './artifacts'

const FILE = 'content/ja.json'

describe('parseTranslationLayer', () => {
  it('reads a flat string map', () => {
    expect(parseTranslationLayer('{"a":"ア"}', FILE)).toEqual({ a: 'ア' })
  })

  it('reads an empty object', () => {
    expect(parseTranslationLayer('{}', FILE)).toEqual({})
  })

  /**
   * The failure this exists for. Every one of these parses as valid JSON, so a
   * bare `JSON.parse(...) as TranslationLayer` accepts them and the pipeline
   * carries on: an array or a null answers every key with `undefined`, which
   * resolves to English on every page of that locale with the build green.
   */
  it.for([
    ['an array', '[]'],
    ['null', 'null'],
    ['a number', '7'],
    ['a string', '"ja"']
  ])('refuses %s, which JSON.parse would accept', ([, text]) => {
    expect(() => parseTranslationLayer(text, FILE)).toThrow(/flat map/)
  })

  /**
   * A nested object is the shape a hand-edit most plausibly produces, by
   * grouping keys under their namespace. It would answer every flat key with
   * `undefined`.
   */
  it('refuses a value that is not a string', () => {
    expect(() => parseTranslationLayer('{"a":{"b":"c"}}', FILE)).toThrow(
      /"a" is not a string/
    )
    expect(() => parseTranslationLayer('{"a":7}', FILE)).toThrow(
      /"a" is not a string/
    )
  })

  it('names the file it could not parse', () => {
    expect(() => parseTranslationLayer('not json', FILE)).toThrow(/content\/ja/)
  })
})
