import { describe, expect, it } from 'vitest'

import type { MockSession } from './useMockSession'
import { DEFAULT_ACCOUNT, transition } from './useMockSession'

const signedOut: MockSession = { status: 'signedOut' }
const signedIn: MockSession = { status: 'signedIn', account: DEFAULT_ACCOUNT }

describe('mock session transition', () => {
  it('signs in with the default account', () => {
    expect(transition(signedOut, { type: 'signIn' })).toEqual(signedIn)
  })

  it('keeps an existing session on a repeated sign in', () => {
    const custom = transition(signedIn, { type: 'setCredits', credits: 0 })
    expect(transition(custom, { type: 'signIn' })).toBe(custom)
  })

  it('updates credits only while signed in', () => {
    expect(transition(signedIn, { type: 'setCredits', credits: 0 })).toEqual({
      status: 'signedIn',
      account: { ...DEFAULT_ACCOUNT, credits: 0 }
    })
    expect(transition(signedOut, { type: 'setCredits', credits: 0 })).toBe(
      signedOut
    )
  })

  it('signs out from any state', () => {
    expect(transition(signedIn, { type: 'signOut' })).toEqual(signedOut)
  })
})
