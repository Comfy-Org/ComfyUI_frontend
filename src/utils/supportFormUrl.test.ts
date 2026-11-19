import { describe, expect, it } from 'vitest'

import { buildSupportFormUrl } from '@/utils/supportFormUrl'

const BASE = 'https://support.example.com/forms/issue'

describe('buildSupportFormUrl', () => {
  it('adds the email and user id when both are present', () => {
    const url = new URL(
      buildSupportFormUrl(BASE, { email: 'a@example.com', userId: 'user-1' })
    )
    expect(url.origin + url.pathname).toBe(BASE)
    expect(url.searchParams.get('email')).toBe('a@example.com')
    expect(url.searchParams.get('comfy_cloud_user_id')).toBe('user-1')
  })

  it('adds only the email when the user id is missing', () => {
    expect(buildSupportFormUrl(BASE, { email: 'a@example.com' })).toBe(
      `${BASE}?email=a%40example.com`
    )
  })

  it.for([
    { name: 'no identity', identity: undefined },
    { name: 'empty values', identity: { email: '', userId: '' } },
    { name: 'null values', identity: { email: null, userId: null } }
  ])('returns the plain url for $name', ({ identity }) => {
    expect(buildSupportFormUrl(BASE, identity)).toBe(BASE)
  })

  it('encodes characters that are special in a query string', () => {
    const url = buildSupportFormUrl(BASE, {
      email: 'a+b@example.com',
      userId: 'id&x=1'
    })
    expect(url).toContain('email=a%2Bb%40example.com')
    expect(url).toContain('comfy_cloud_user_id=id%26x%3D1')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('email')).toBe('a+b@example.com')
    expect(parsed.searchParams.get('comfy_cloud_user_id')).toBe('id&x=1')
  })
})
