import { describe, expect, it } from 'vitest'

import { isApiJson, sanitizeNodeName } from './appUtil'

describe('sanitizeNodeName', () => {
  it('strips dangerous HTML entity characters', () => {
    expect(sanitizeNodeName('a&b<c>d"e\'f`g=h')).toBe('abcdefgh')
  })

  it('returns the string unchanged when no entities are present', () => {
    expect(sanitizeNodeName('KSampler')).toBe('KSampler')
  })

  it('handles empty string', () => {
    expect(sanitizeNodeName('')).toBe('')
  })
})

describe('isApiJson', () => {
  it('accepts valid API workflow data', () => {
    const data = {
      '1': { class_type: 'KSampler', inputs: { seed: 42 } },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: 'hello' } }
    }
    expect(isApiJson(data)).toBe(true)
  })

  it('rejects empty object', () => {
    expect(isApiJson({})).toBe(false)
  })

  it('rejects arrays', () => {
    expect(isApiJson([1, 2, 3])).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isApiJson('string')).toBe(false)
    expect(isApiJson(42)).toBe(false)
    expect(isApiJson(null)).toBe(false)
  })

  it('rejects when a node lacks class_type', () => {
    expect(isApiJson({ '1': { inputs: { seed: 42 } } })).toBe(false)
  })

  it('rejects when inputs is an array instead of object', () => {
    expect(isApiJson({ '1': { class_type: 'KSampler', inputs: [1, 2] } })).toBe(
      false
    )
  })

  it('rejects malformed node values', () => {
    expect(isApiJson({ '1': null })).toBe(false)
    expect(isApiJson({ '1': 'KSampler' })).toBe(false)
    expect(isApiJson({ '1': 42 })).toBe(false)
  })

  it('rejects a non-string class_type', () => {
    expect(isApiJson({ '1': { class_type: 42, inputs: {} } })).toBe(false)
  })

  it('rejects null inputs', () => {
    expect(isApiJson({ '1': { class_type: 'KSampler', inputs: null } })).toBe(
      false
    )
  })
})
