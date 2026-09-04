import { describe, expect, it } from 'vitest'

import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'

import { workspaceAvatarStyle } from './avatarColor'

describe('workspaceAvatarStyle', () => {
  it('is neutral when the tier is unavailable', () => {
    expect(workspaceAvatarStyle('Acme', undefined)).toEqual({})
  })

  it('falls back to the Free plan for a null tier and a tier added by the backend', () => {
    const freeStyle = workspaceAvatarStyle('Acme', null)

    expect(freeStyle).not.toEqual({})
    expect(
      workspaceAvatarStyle('Acme', 'FUTURE_TIER' as unknown as SubscriptionTier)
    ).toEqual(freeStyle)
  })

  it('maps the legacy Creator tiers to the Creator plan', () => {
    const creatorStyle = workspaceAvatarStyle('Acme', 'CREATOR')

    expect(workspaceAvatarStyle('Acme', 'STANDARD')).toEqual(creatorStyle)
    expect(workspaceAvatarStyle('Acme', 'FOUNDERS_EDITION')).toEqual(
      creatorStyle
    )
    expect(creatorStyle).not.toEqual(workspaceAvatarStyle('Acme', null))
  })
})
