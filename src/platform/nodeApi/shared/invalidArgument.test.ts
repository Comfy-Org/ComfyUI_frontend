import { describe, expect, it } from 'vitest'

import {
  callOutOfTurn,
  invalidArgument,
  isInvalidArgument
} from './invalidArgument'

describe('refusing an argument', () => {
  it.for([
    { received: 'visibel', shown: "'visibel'" },
    { received: 5, shown: '5' },
    { received: null, shown: 'null' },
    { received: undefined, shown: 'undefined' },
    { received: Symbol('scope'), shown: 'Symbol(scope)' },
    { received: 10n, shown: '10n' },
    { received: {}, shown: 'an object' },
    { received: Object.create(null), shown: 'an object' },
    { received: [1], shown: 'a list' },
    { received: new Date(0), shown: 'an instance of Date' },
    { received: () => {}, shown: 'a function' },
    { received: 'x'.repeat(200), shown: `'${'x'.repeat(79)}…'` }
  ])('names the member, what it needs, and $shown', ({ received, shown }) => {
    const error = invalidArgument('queryNodes', 'a query object', received)

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toBe(`queryNodes needs a query object, not ${shown}.`)
  })

  it('says when a member called out of turn can be called', () => {
    const error = callOutOfTurn('setValue', 'while its hook runs')

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toBe(
      'setValue can only be called while its hook runs.'
    )
    expect(isInvalidArgument(error)).toBe(true)
  })

  it('knows its own refusals from any other TypeError', () => {
    expect(isInvalidArgument(invalidArgument('extend', 'a name', 5))).toBe(true)
    expect(isInvalidArgument(new TypeError('extend needs a name'))).toBe(false)
    expect(isInvalidArgument('extend needs a name')).toBe(false)
  })
})
