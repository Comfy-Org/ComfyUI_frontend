import { describe, expect, it } from 'vitest'

import { resolveValue } from './resolve'

describe('resolveValue', () => {
  it('prefers an approved translation over the model output', () => {
    expect(resolveValue('Build', '构建', 'MACHINE')).toEqual({
      value: '构建',
      provenance: 'approved'
    })
  })

  it('uses the model output when nobody has written one', () => {
    expect(resolveValue('Build', undefined, '構築')).toEqual({
      value: '構築',
      provenance: 'machine'
    })
  })

  it('falls back to English when neither layer has it', () => {
    expect(resolveValue('Build', undefined, undefined)).toEqual({
      value: 'Build',
      provenance: 'english'
    })
  })

  /**
   * `translations.ts` blanks one half of a word-order fragment pair per language
   * so each can order a heading its own way. An approved empty string is a real
   * answer meaning "this language needs nothing here". Treating it as missing
   * would let the model fill it and the page would render both halves.
   */
  it('treats an approved empty string as an answer, not as missing', () => {
    expect(resolveValue('{name} in', '', 'SHOULD NOT WIN')).toEqual({
      value: '',
      provenance: 'approved'
    })
  })

  it('treats a machine empty string as an answer too', () => {
    expect(resolveValue('{name} in', undefined, '')).toEqual({
      value: '',
      provenance: 'machine'
    })
  })
})
