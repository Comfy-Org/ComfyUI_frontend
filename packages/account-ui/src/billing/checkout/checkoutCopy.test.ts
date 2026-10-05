import { describe, expect, it } from 'vitest'

import { splitPlaceholders } from './checkoutCopy'

describe('splitPlaceholders', () => {
  it('splits prose around each known token in order', () => {
    expect(
      splitPlaceholders('Agree to {terms} and {privacy}.', ['terms', 'privacy'])
    ).toEqual([
      { kind: 'text', text: 'Agree to ' },
      { kind: 'slot', key: 'terms' },
      { kind: 'text', text: ' and ' },
      { kind: 'slot', key: 'privacy' },
      { kind: 'text', text: '.' }
    ])
  })

  it('leaves an unknown token as prose', () => {
    expect(splitPlaceholders('{amount} for {plan}', ['amount'])).toEqual([
      { kind: 'slot', key: 'amount' },
      { kind: 'text', text: ' for {plan}' }
    ])
  })
})
