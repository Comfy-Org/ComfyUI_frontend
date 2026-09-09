import { describe, expect, it } from 'vitest'

import { segments } from './segments'

describe('segments', () => {
  it('returns a single piece of text when there is nothing to fill', () => {
    expect(segments('Thanks for reaching out.')).toEqual([
      { type: 'text', value: 'Thanks for reaching out.' }
    ])
  })

  it('splits a slot out of the surrounding text', () => {
    expect(segments('Email us at {email} today')).toEqual([
      { type: 'text', value: 'Email us at ' },
      { type: 'slot', name: 'email' },
      { type: 'text', value: ' today' }
    ])
  })

  it('lets a language put the slots in its own order', () => {
    // The whole point: an English sentence and its Chinese translation name the
    // same slots but place them differently. Splitting a sentence into fixed
    // fragments instead, which is what the pages do today, forces English word
    // order onto every language.
    const en = segments('{standard} and {teams} for creators')
    const zh = segments('面向创作者的 {teams} 和 {standard}')

    expect(en.filter((s) => s.type === 'slot').map((s) => s.name)).toEqual([
      'standard',
      'teams'
    ])
    expect(zh.filter((s) => s.type === 'slot').map((s) => s.name)).toEqual([
      'teams',
      'standard'
    ])
  })

  it('handles slots that sit against each other', () => {
    expect(segments('{a}{b}')).toEqual([
      { type: 'slot', name: 'a' },
      { type: 'slot', name: 'b' }
    ])
  })

  it('keeps a lone brace as ordinary text rather than guessing', () => {
    expect(segments('a { b')).toEqual([{ type: 'text', value: 'a { b' }])
  })

  it('returns nothing for an empty string', () => {
    expect(segments('')).toEqual([])
  })
})
