import { describe, expect, it, vi } from 'vitest'

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

  it('surfaces an async remote-apply fn loudly (continuations escape the scope)', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const session = createMintSession()

    void session.runRemoteApply(async () => {})

    expect(consoleError).toHaveBeenCalledOnce()
    expect(session.inRemoteApply()).toBe(false)
    consoleError.mockRestore()
  })

  it('stays silent for a synchronous remote-apply fn', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const session = createMintSession()

    session.runRemoteApply(() => 42)

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
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
