import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const distribution = vi.hoisted(() => ({ isCloud: true }))
const currentUser = vi.hoisted(() => ({
  userDisplayName: { value: 'Current User' },
  userEmail: { value: 'current@example.com' }
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => currentUser
}))

import {
  isTeammateOwned,
  teammateFor
} from '@/platform/assets/composables/assetOwnerMock'
import {
  AUTHOR_ME,
  useAssetSharing
} from '@/platform/assets/composables/useAssetSharing'
import { useAssetVisibilityStore } from '@/platform/assets/composables/useAssetVisibilityStore'

function assetIdWithOwnership(teammateOwned: boolean): string {
  const assetId = ['a', 'b', 'c', 'd'].find(
    (id) => isTeammateOwned(id) === teammateOwned
  )
  if (!assetId) throw new Error('Expected an asset id for each ownership type')
  return assetId
}

const SELF_OWNED_ASSET_ID = assetIdWithOwnership(false)
const TEAMMATE_OWNED_ASSET_ID = assetIdWithOwnership(true)

describe('useAssetSharing', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    distribution.isCloud = true
    currentUser.userDisplayName.value = 'Current User'
    currentUser.userEmail.value = 'current@example.com'
  })

  it('keeps sharing unavailable outside cloud builds', () => {
    distribution.isCloud = false
    useAssetVisibilityStore().share([SELF_OWNED_ASSET_ID])
    const sharing = useAssetSharing()

    expect(sharing.isShared(SELF_OWNED_ASSET_ID)).toBe(false)
    expect(sharing.isShared(TEAMMATE_OWNED_ASSET_ID)).toBe(false)
    expect(sharing.canShare(SELF_OWNED_ASSET_ID)).toBe(false)
    expect(sharing.canShare(TEAMMATE_OWNED_ASSET_ID)).toBe(false)
    expect(sharing.sharedOwnerFor(SELF_OWNED_ASSET_ID)).toBeUndefined()
    expect(sharing.sharedOwnerFor(TEAMMATE_OWNED_ASSET_ID)).toBeUndefined()
  })

  it('uses the current user for self-owned assets shared from the store', () => {
    const sharing = useAssetSharing()

    expect(sharing.isShared(SELF_OWNED_ASSET_ID)).toBe(false)
    expect(sharing.canShare(SELF_OWNED_ASSET_ID)).toBe(true)
    expect(sharing.sharedOwnerFor(SELF_OWNED_ASSET_ID)).toBeUndefined()
    expect(sharing.matchesAuthor(SELF_OWNED_ASSET_ID, AUTHOR_ME)).toBe(true)

    useAssetVisibilityStore().share([SELF_OWNED_ASSET_ID])

    expect(sharing.isShared(SELF_OWNED_ASSET_ID)).toBe(true)
    expect(sharing.sharedOwnerFor(SELF_OWNED_ASSET_ID)).toEqual({
      name: 'Current User'
    })
  })

  it('treats teammate-owned assets as shared but not shareable', () => {
    const sharing = useAssetSharing()
    const teammate = teammateFor(TEAMMATE_OWNED_ASSET_ID)

    expect(sharing.isShared(TEAMMATE_OWNED_ASSET_ID)).toBe(true)
    expect(sharing.canShare(TEAMMATE_OWNED_ASSET_ID)).toBe(false)
    expect(sharing.sharedOwnerFor(TEAMMATE_OWNED_ASSET_ID)).toEqual(teammate)
    expect(sharing.matchesAuthor(TEAMMATE_OWNED_ASSET_ID, teammate.name)).toBe(
      true
    )
    expect(sharing.matchesAuthor(TEAMMATE_OWNED_ASSET_ID, AUTHOR_ME)).toBe(
      false
    )
  })
})
