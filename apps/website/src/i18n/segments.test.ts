import { describe, expect, it } from 'vitest'

import { PLAN_LABELS } from '../components/individual-submission/planLabels'
import resolved from './resolved/en.json'
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

/**
 * A slot the page has no label for renders as nothing at all: the sentence
 * loses a word and the build stays green. The translation side is already safe,
 * because `collectViolations` rejects a translation whose placeholder set
 * differs from the English. What nothing guarded is the English itself drifting
 * from the map the page fills those slots from.
 */
describe('every slot the copy uses has a label to fill it', () => {
  // The page's own map, not a copy of it: a copy stayed green through a
  // rename while the page rendered an empty slot where the plan name belonged.
  const known = Object.keys(PLAN_LABELS)

  it('individualSubmission.plans names only known plans', () => {
    const english: string = resolved['individualSubmission.plans']
    const used = segments(english)
      .filter((segment) => segment.type === 'slot')
      .map((segment) => segment.name)

    expect(used.length).toBeGreaterThan(0)
    expect(used.filter((name) => !known.includes(name))).toEqual([])
  })
})

/**
 * A near-miss token has to stay text rather than become a slot the page never
 * fills — an unfilled slot renders as nothing, so the sentence loses a word
 * silently. Only the lone opening brace was pinned; a parser change could have
 * altered any of these without failing a test.
 */
describe('tokens that look like slots but are not', () => {
  it('leaves an empty slot name as text', () => {
    expect(segments('a {} b')).toEqual([{ type: 'text', value: 'a {} b' }])
  })

  it('leaves a lone closing brace as text', () => {
    expect(segments('a } b')).toEqual([{ type: 'text', value: 'a } b' }])
  })

  /** The inner braces are the slot; the outer pair stays as written. */
  it('reads a nested brace as one slot between two literals', () => {
    expect(segments('{{count}}')).toEqual([
      { type: 'text', value: '{' },
      { type: 'slot', name: 'count' },
      { type: 'text', value: '}' }
    ])
  })

  it('leaves a name that does not start with a letter as text', () => {
    expect(segments('{1st}')).toEqual([{ type: 'text', value: '{1st}' }])
  })
})
