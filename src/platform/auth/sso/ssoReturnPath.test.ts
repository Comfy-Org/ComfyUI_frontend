import { describe, expect, it } from 'vitest'

import { toSsoReturnPath } from '@/platform/auth/sso/ssoReturnPath'

describe('toSsoReturnPath', () => {
  it.for([
    {
      name: 'the SPA-only consent path',
      input: '/oauth/consent?oauth_request_id=req-1',
      expected: '/cloud/oauth/consent?oauth_request_id=req-1'
    },
    {
      name: 'the consent path with a trailing slash',
      input: '/oauth/consent/?oauth_request_id=req-1',
      expected: '/cloud/oauth/consent?oauth_request_id=req-1'
    },
    {
      name: 'the served consent path',
      input: '/cloud/oauth/consent?oauth_request_id=req-1',
      expected: '/cloud/oauth/consent?oauth_request_id=req-1'
    },
    {
      name: 'any other app path',
      input: '/workflows?id=7#top',
      expected: '/workflows?id=7#top'
    },
    {
      name: 'a path that only starts like the consent path',
      input: '/oauth/consent-help',
      expected: '/oauth/consent-help'
    }
  ])('returns $expected for $name', ({ input, expected }) => {
    expect(toSsoReturnPath(input)).toBe(expected)
  })
})
