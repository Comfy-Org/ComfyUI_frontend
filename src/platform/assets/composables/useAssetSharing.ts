import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'

import type { AssetOwner } from './assetOwnerMock'
import { MOCK_TEAMMATES, isTeammateOwned, teammateFor } from './assetOwnerMock'
import { useAssetVisibilityStore } from './useAssetVisibilityStore'

/** "Created by" value meaning the current user. */
export const AUTHOR_ME = 'Me'

/**
 * Effective sharing + ownership for the media-assets sidebar.
 *
 * REFERENCE BUILD — ownership is MOCKED via {@link assetOwnerMock}: a
 * deterministic slice of assets reads as teammate-owned (so already shared, and
 * not yours to toggle), which is what drives the teammate avatars and the
 * "Created by" filter. Only the current user + the client-side visibility store
 * are real. When a real owner/publisher API lands, replace the assetOwnerMock
 * calls below.
 */
export function useAssetSharing() {
  const visibilityStore = useAssetVisibilityStore()
  const { userDisplayName, userEmail } = useCurrentUser()

  const currentUser = computed<AssetOwner>(() => ({
    name: userDisplayName.value || userEmail.value || t('g.you')
  }))

  // Sharing is a team-workspace concept; desktop/OSS builds have no team, so
  // everything reads as private and unshareable there (matching the isCloud
  // gate on the filter menu).
  function isShared(assetId: string): boolean {
    // MOCK: teammate-owned assets always read as shared (real shares come from
    // the visibility store).
    return (
      isCloud && (visibilityStore.isShared(assetId) || isTeammateOwned(assetId))
    )
  }

  function canShare(assetId: string): boolean {
    return isCloud && !isTeammateOwned(assetId)
  }

  /** Avatar for a shared card — undefined when the asset is private. */
  function avatarFor(assetId: string): AssetOwner | undefined {
    if (!isShared(assetId)) return undefined
    return isTeammateOwned(assetId) ? teammateFor(assetId) : currentUser.value
  }

  function matchesAuthor(assetId: string, author: string): boolean {
    if (author === AUTHOR_ME) return !isTeammateOwned(assetId)
    return isTeammateOwned(assetId) && teammateFor(assetId).name === author
  }

  // MOCK: fake teammate names populate the "Created by" filter options.
  const authorOptions = computed<string[]>(() => [
    AUTHOR_ME,
    ...MOCK_TEAMMATES.map((teammate) => teammate.name)
  ])

  return {
    isShared,
    canShare,
    avatarFor,
    matchesAuthor,
    authorOptions
  }
}
