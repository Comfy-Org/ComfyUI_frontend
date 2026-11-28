import { describe, expect, it } from 'vitest'

import type { SsoSignInEvent, SsoSignInState } from './ssoSignInState'
import { reduceSsoSignIn } from './ssoSignInState'

describe('reduceSsoSignIn', () => {
  it.for<{
    name: string
    from: SsoSignInState['phase']
    event: SsoSignInEvent
    to: SsoSignInState['phase']
  }>([
    {
      name: 'a submit starts a check',
      from: 'idle',
      event: { type: 'submitted' },
      to: 'checking'
    },
    {
      name: 'a resubmit after a message starts a new check',
      from: 'not-sso',
      event: { type: 'submitted' },
      to: 'checking'
    },
    {
      name: 'a second submit does not restart a check in flight',
      from: 'checking',
      event: { type: 'submitted' },
      to: 'checking'
    },
    {
      name: 'a submit is ignored once the redirect has started',
      from: 'redirecting',
      event: { type: 'submitted' },
      to: 'redirecting'
    },
    {
      name: 'an SSO email redirects',
      from: 'checking',
      event: {
        type: 'discovered',
        discovery: { kind: 'sso', required: true },
        via: 'email-sign-in'
      },
      to: 'redirecting'
    },
    {
      name: 'an optional-mode email chosen for SSO redirects',
      from: 'checking',
      event: {
        type: 'discovered',
        discovery: { kind: 'sso', required: false },
        via: 'sso-entry'
      },
      to: 'redirecting'
    },
    {
      name: 'an optional-mode email from the email sign-in goes back to idle',
      from: 'checking',
      event: {
        type: 'discovered',
        discovery: { kind: 'sso', required: false },
        via: 'email-sign-in'
      },
      to: 'idle'
    },
    {
      name: 'a non-SSO email says so',
      from: 'checking',
      event: {
        type: 'discovered',
        discovery: { kind: 'not-sso' },
        via: 'sso-entry'
      },
      to: 'not-sso'
    },
    {
      name: 'a rejected email says so',
      from: 'checking',
      event: {
        type: 'discovered',
        discovery: { kind: 'invalid-email' },
        via: 'sso-entry'
      },
      to: 'invalid-email'
    },
    {
      name: 'an outage says so',
      from: 'checking',
      event: {
        type: 'discovered',
        discovery: { kind: 'unavailable' },
        via: 'sso-entry'
      },
      to: 'unavailable'
    },
    {
      name: 'a stray discovery outside a check is ignored',
      from: 'idle',
      event: {
        type: 'discovered',
        discovery: { kind: 'sso', required: true },
        via: 'sso-entry'
      },
      to: 'idle'
    },
    {
      name: 'a bfcache restore clears a redirect that never left',
      from: 'redirecting',
      event: { type: 'restored' },
      to: 'idle'
    }
  ])('$name', ({ from, event, to }) => {
    expect(reduceSsoSignIn({ phase: from }, event)).toEqual({ phase: to })
  })
})
