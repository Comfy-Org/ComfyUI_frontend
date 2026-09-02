import { describe, expect, it } from 'vitest'

import type { MockSession } from './useMockSession'
import {
  EXISTING_CREDITS,
  WELCOME_CREDITS,
  accountFor,
  transition
} from './useMockSession'

const signedOut: MockSession = { status: 'signedOut' }
const existing: MockSession = {
  status: 'signedIn',
  account: accountFor('existing')
}

describe('mock session transition', () => {
  it('gives a new account the welcome credits and no subscription', () => {
    expect(transition(signedOut, { type: 'signIn', kind: 'new' })).toEqual({
      status: 'signedIn',
      account: expect.objectContaining({
        credits: WELCOME_CREDITS,
        subscribed: false
      })
    })
  })

  it('gives an existing account its balance and subscription', () => {
    expect(transition(signedOut, { type: 'signIn', kind: 'existing' })).toEqual(
      {
        status: 'signedIn',
        account: expect.objectContaining({
          credits: EXISTING_CREDITS,
          subscribed: true
        })
      }
    )
  })

  it('adjusts credits only while signed in and never below zero', () => {
    expect(transition(existing, { type: 'setCredits', credits: 0 })).toEqual({
      status: 'signedIn',
      account: { ...accountFor('existing'), credits: 0 }
    })
    expect(
      transition(existing, {
        type: 'addCredits',
        credits: -EXISTING_CREDITS - 5
      })
    ).toMatchObject({ account: { credits: 0 } })
    expect(transition(signedOut, { type: 'addCredits', credits: 10 })).toBe(
      signedOut
    )
  })

  it('toggles the subscription', () => {
    expect(
      transition(existing, { type: 'setSubscribed', subscribed: false })
    ).toMatchObject({ account: { subscribed: false } })
  })

  it('signs out from any state', () => {
    expect(transition(existing, { type: 'signOut' })).toEqual(signedOut)
  })
})
