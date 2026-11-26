import { describe, expect, it } from 'vitest'

import {
  callOutOfTurn,
  invalidArgument,
  isInvalidArgument
} from './invalidArgument'

describe('refusing an argument', () => {
  it.for([
    { received: 'visibel', shown: "'visibel'", of: 'text' },
    { received: 5, shown: '5', of: 'a number' },
    { received: null, shown: 'null', of: 'null' },
    { received: undefined, shown: 'undefined', of: 'undefined' },
    { received: Symbol('scope'), shown: 'Symbol(scope)', of: 'a symbol' },
    { received: 10n, shown: '10n', of: 'a bigint' },
    { received: {}, shown: 'an object', of: 'an object literal' },
    {
      received: Object.create(null),
      shown: 'an object',
      of: 'an object with no prototype'
    },
    { received: [1], shown: 'a list', of: 'a list' },
    { received: new Date(0), shown: 'an instance of Date', of: 'a Date' },
    { received: () => {}, shown: 'a function', of: 'a function' },
    {
      received: 'x'.repeat(200),
      shown: `'${'x'.repeat(79)}…'`,
      of: 'long text'
    }
  ])(
    'names the member, what it needs, and how it shows $of',
    ({ received, shown }) => {
      const error = invalidArgument('queryNodes', 'a query object', received)

      expect(error).toBeInstanceOf(TypeError)
      expect(error.message).toBe(
        `queryNodes needs a query object, not ${shown}.`
      )
    }
  )

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
