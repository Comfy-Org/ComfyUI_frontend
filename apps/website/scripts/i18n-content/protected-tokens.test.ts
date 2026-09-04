import { describe, expect, it } from 'vitest'

import { protectedTokens, tokenErrors } from './protected-tokens'

describe('protectedTokens', () => {
  it('extracts component tags by name, src/href values, and link URLs', () => {
    expect(
      protectedTokens(
        '<Figure src="https://x.test/a.png" alt="A" /> read [more](https://x.test/b)'
      )
    ).toEqual(['<Figure>', 'https://x.test/a.png', 'https://x.test/b'])
  })

  it('does not protect non-URL attributes like alt or caption', () => {
    expect(
      protectedTokens('<Figure src="https://x.test/a.png" alt="Old caption" />')
    ).not.toContain('Old caption')
  })

  it('returns nothing for plain prose', () => {
    expect(protectedTokens('ComfyUI runs anywhere.')).toEqual([])
  })
})

describe('tokenErrors', () => {
  it('allows alt/caption text to be translated', () => {
    expect(
      tokenErrors(
        '<Figure src="https://x.test/a.png" alt="USC campus" />',
        '<Figure src="https://x.test/a.png" alt="USCキャンパス" />'
      )
    ).toEqual([])
  })

  it('flags a changed src URL', () => {
    expect(
      tokenErrors(
        '<Figure src="https://x.test/a.png" />',
        '<Figure src="https://x.test/translated.png" />'
      )
    ).toEqual([
      'missing https://x.test/a.png',
      'added https://x.test/translated.png'
    ])
  })

  it('flags a dropped component', () => {
    expect(
      tokenErrors('<Quote>Great tool</Quote>', '素晴らしいツール')
    ).toEqual(['missing </Quote>, <Quote>'])
  })
})
