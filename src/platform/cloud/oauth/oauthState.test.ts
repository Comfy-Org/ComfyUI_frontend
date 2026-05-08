import { beforeEach, describe, expect, it } from 'vitest'

import {
  captureOAuthRequestId,
  clearOAuthRequestId,
  getOAuthRequestId,
  hasOAuthRequestId
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
    expect(hasOAuthRequestId()).toBe(true)
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
