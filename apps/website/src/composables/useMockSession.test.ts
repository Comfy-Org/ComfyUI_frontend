// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

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

const STORAGE_KEY = 'comfy-workshop-mock-session'

async function mountFresh() {
  vi.resetModules()
  const { useMockSession } = await import('./useMockSession')
  let api!: ReturnType<typeof useMockSession>
  render(
    defineComponent({
      setup() {
        api = useMockSession()
        return () => h('div')
      }
    })
  )
  return api
}

describe('useMockSession persistence', () => {
  beforeEach(() => localStorage.clear())

  it('hydrates a stored session on mount', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        status: 'signedIn',
        account: { credits: 12, subscribed: true }
      })
    )
    const api = await mountFresh()
    expect(api.session.value).toMatchObject({
      status: 'signedIn',
      account: { credits: 12, subscribed: true }
    })
  })

  it('keeps a stored member in their role after a reload', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        status: 'signedIn',
        account: { credits: 0, subscribed: true, role: 'member' }
      })
    )
    const api = await mountFresh()
    expect(api.session.value).toMatchObject({
      status: 'signedIn',
      account: { role: 'member' }
    })
  })

  it('falls back to signed out on malformed or incomplete storage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect((await mountFresh()).session.value).toEqual(signedOut)

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ status: 'signedIn', account: {} })
    )
    expect((await mountFresh()).session.value).toEqual(signedOut)
  })

  it('persists every dispatch', async () => {
    const api = await mountFresh()
    api.signIn('new')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toMatchObject({
      status: 'signedIn',
      account: { credits: WELCOME_CREDITS }
    })
    api.signOut()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(
      signedOut
    )
  })
})
