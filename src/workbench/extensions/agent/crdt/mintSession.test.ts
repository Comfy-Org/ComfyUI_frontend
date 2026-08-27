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

  it('closes the remote-apply scope even when the body throws', () => {
    const session = createMintSession()

    expect(() =>
      session.runRemoteApply(() => {
        expect(session.inRemoteApply()).toBe(true)
        throw new Error('applier rejected')
      })
    ).toThrow('applier rejected')
    expect(session.inRemoteApply()).toBe(false)
  })
})
