import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cloudIdentityProvider } from './cloudSurveyIdentity'

const currentUser = vi.hoisted(
  (): { resolvedUserInfo: { value: { id: string } | null } } => ({
    resolvedUserInfo: { value: null }
  })
)
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => currentUser
}))

const distinctId = vi.hoisted((): { value: string | null } => ({ value: null }))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ getDistinctId: () => distinctId.value })
}))

describe('cloudIdentityProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    currentUser.resolvedUserInfo.value = null
    distinctId.value = null
  })

  it('uses the stable local id as anon_id regardless of PostHog', () => {
    distinctId.value = 'ph-123'

    const identity = cloudIdentityProvider.getIdentity()

    expect(identity.anon_id).toBe(localStorage.getItem('Comfy.SurveyAnonId'))
    expect(identity.anon_id).not.toBe('ph-123')
  })

  it('sends the PostHog distinct id as a separate field for stitching', () => {
    distinctId.value = 'ph-123'

    expect(cloudIdentityProvider.getIdentity().distinct_id).toBe('ph-123')
  })

  it('omits distinct_id when PostHog has none', () => {
    expect(cloudIdentityProvider.getIdentity().distinct_id).toBeUndefined()
  })

  it('includes the authenticated id when signed in', () => {
    currentUser.resolvedUserInfo.value = { id: 'uid-1' }

    expect(cloudIdentityProvider.getIdentity().comfy_id).toBe('uid-1')
  })

  it('omits the authenticated id for an anonymous visitor', () => {
    expect(cloudIdentityProvider.getIdentity().comfy_id).toBeUndefined()
  })
})
