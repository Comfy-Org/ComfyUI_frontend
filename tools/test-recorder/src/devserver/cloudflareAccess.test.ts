import { describe, expect, it } from 'vitest'

import { hasAccessServiceToken } from './cloudflareAccess'

describe('hasAccessServiceToken', () => {
  it('reports a complete service token', () => {
    expect(
      hasAccessServiceToken({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).toBe(true)
  })

  it.for([
    { label: 'an empty environment', env: {} },
    {
      label: 'a client id alone',
      env: { DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access' }
    },
    {
      label: 'a client secret alone',
      env: { DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret' }
    }
  ])('reports no token for $label', ({ env }) => {
    expect(hasAccessServiceToken(env)).toBe(false)
  })
})
