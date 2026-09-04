import { describe, expect, it } from 'vitest'

import { createMintSession } from './mintSession'

describe('createMintSession', () => {
  it('nests teardown brackets: the scope closes only at the outermost end', () => {
    const session = createMintSession()
    session.beginGraphTeardown()
    session.beginGraphTeardown()
    session.endGraphTeardown()

    expect(session.inTeardown()).toBe(true)

    session.endGraphTeardown()
    expect(session.inTeardown()).toBe(false)
  })
})
