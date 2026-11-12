import { describe, expect, it } from 'vitest'

import { invalidArgument } from './invalidArgument'

describe('refusing an argument', () => {
  it.for([
    { received: 'visibel', shown: "'visibel'" },
    { received: 5, shown: '5' },
    { received: null, shown: 'null' },
    { received: undefined, shown: 'undefined' },
    { received: Symbol('scope'), shown: 'Symbol(scope)' },
    { received: {}, shown: 'a value of type object' },
    { received: Object.create(null), shown: 'a value of type object' },
    { received: () => {}, shown: 'a value of type function' }
  ])('names the member, what it needs, and $shown', ({ received, shown }) => {
    const error = invalidArgument('queryNodes', 'a query object', received)

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toBe(`queryNodes needs a query object, not ${shown}.`)
  })
})
