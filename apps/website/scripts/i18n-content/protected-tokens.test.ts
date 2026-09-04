import { describe, expect, it } from 'vitest'

import { protectedTokens, tokenErrors } from './protected-tokens'

describe('protectedTokens', () => {
  it('extracts component tags by name, src/href/id values, and link URLs', () => {
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

  it('keeps dotted and hyphenated component names distinct', () => {
    const tokens = protectedTokens('<Hero.Title>x</Hero.Title> <my-widget />')
    expect(tokens).toContain('<Hero.Title>')
    expect(tokens).toContain('</Hero.Title>')
    expect(tokens).toContain('<my-widget>')
    expect(tokens).not.toContain('<Hero>')
  })

  it('protects an id attribute value, single- or double-quoted', () => {
    expect(protectedTokens('<Section id="topic-1">')).toContain('topic-1')
    expect(protectedTokens("<Section id='topic-1'>")).toContain('topic-1')
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

  it('flags a section id that was translated or renumbered', () => {
    expect(
      tokenErrors('<Section id="topic-1">', '<Section id="話題-1">')
    ).toEqual(['missing topic-1', 'added 話題-1'])
  })

  it('flags a dropped component', () => {
    expect(
      tokenErrors('<Quote>Great tool</Quote>', '素晴らしいツール')
    ).toEqual(['missing </Quote>, <Quote>'])
  })

  it('flags a dropped component that survived elsewhere in the same document', () => {
    expect(
      tokenErrors('<Quote>a</Quote> <Quote>b</Quote>', '<Quote>a と b</Quote>')
    ).toEqual(['missing </Quote>, <Quote>'])
  })

  it('reports the deficit count when more than one occurrence is missing', () => {
    expect(
      tokenErrors(
        '<Quote>a</Quote> <Quote>b</Quote> <Quote>c</Quote>',
        '<Quote>a</Quote>'
      )
    ).toEqual(['missing </Quote>×2, <Quote>×2'])
  })

  it('flags a dropped repeated markdown link', () => {
    expect(
      tokenErrors(
        '[one](https://x.test/1) and [two](https://x.test/1)',
        '[one](https://x.test/1)のみ'
      )
    ).toEqual(['missing https://x.test/1'])
  })

  it('flags an empty translation of a non-empty source', () => {
    expect(tokenErrors('Save now', '')).toEqual(['empty translation'])
  })
})
