import { describe, expect, it } from 'vitest'

import { toTitleCase } from './textCaseUtil'

describe('toTitleCase', () => {
  it.for([
    ['STAGING ENVIRONMENT', 'Staging Environment'],
    ['DEV ENVIRONMENT', 'Dev Environment'],
    ['PREVIEW ENVIRONMENT', 'Preview Environment']
  ])('recases the shouted %s', ([shouted, expected]) => {
    expect(toTitleCase(shouted)).toBe(expected)
  })

  it('leaves a message that carries its own casing alone', () => {
    expect(toTitleCase('ComfyUI is degraded')).toBe('ComfyUI is degraded')
  })

  it('keeps punctuation that a word-splitting recase would drop', () => {
    expect(toTitleCase('STAGING ENVIRONMENT (US-EAST-1)')).toBe(
      'Staging Environment (us-east-1)'
    )
  })
})
