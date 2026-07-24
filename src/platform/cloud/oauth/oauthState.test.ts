import { beforeEach, describe, expect, it } from 'vitest'

import {
  captureOAuthRequestId,
  clearOAuthRequestId,
  getOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'

describe('oauthState', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearOAuthRequestId()
  })

  it('captures a valid oauth_request_id only', () => {
    captureOAuthRequestId({
      oauth_request_id: '550e8400-e29b-41d4-a716-446655440000',
      client_id: 'must-not-be-stored'
    })

    expect(getOAuthRequestId()).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(sessionStorage.getItem('Comfy.OAuthRequestId')).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })

  it('ignores missing, repeated, and invalid request ids', () => {
    captureOAuthRequestId({})
    expect(getOAuthRequestId()).toBeNull()

    captureOAuthRequestId({ oauth_request_id: ['a', 'b'] })
    expect(getOAuthRequestId()).toBeNull()

    captureOAuthRequestId({ oauth_request_id: 'not-a-uuid' })
    expect(getOAuthRequestId()).toBeNull()
  })

  it('preserves a stored id when the query has no oauth_request_id key', () => {
    // The router guard runs on every navigation, including the OAuth
    // return-trip from a social-login provider (Google / GitHub) which
    // arrives at /login with `code` + `state` but no oauth_request_id.
    // The previously-captured id MUST survive that hop.
    sessionStorage.setItem(
      'Comfy.OAuthRequestId',
      '550e8400-e29b-41d4-a716-446655440000'
    )

    captureOAuthRequestId({ code: 'oauth-provider-code', state: 'xyz' })

    expect(getOAuthRequestId()).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('clears a stored id when the query has an invalid oauth_request_id', () => {
    // Stale deep-link or probing — drop the stored value rather than let
    // it steer later flows into an expired consent request.
    sessionStorage.setItem(
      'Comfy.OAuthRequestId',
      '550e8400-e29b-41d4-a716-446655440000'
    )

    captureOAuthRequestId({ oauth_request_id: 'not-a-uuid' })

    expect(getOAuthRequestId()).toBeNull()
    expect(sessionStorage.getItem('Comfy.OAuthRequestId')).toBeNull()
  })

  it('clears a stored id when the query has a repeated oauth_request_id', () => {
    sessionStorage.setItem(
      'Comfy.OAuthRequestId',
      '550e8400-e29b-41d4-a716-446655440000'
    )

    captureOAuthRequestId({ oauth_request_id: ['a', 'b'] })

    expect(getOAuthRequestId()).toBeNull()
  })

  it('hydrates from session storage and clears after completion', () => {
    sessionStorage.setItem(
      'Comfy.OAuthRequestId',
      '550e8400-e29b-41d4-a716-446655440000'
    )

    expect(getOAuthRequestId()).toBe('550e8400-e29b-41d4-a716-446655440000')

    clearOAuthRequestId()

    expect(getOAuthRequestId()).toBeNull()
    expect(sessionStorage.getItem('Comfy.OAuthRequestId')).toBeNull()
  })
})
