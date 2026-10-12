import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isDesktopHostSignedIn } from '@/platform/auth/desktopHost/desktopHostSession'
import { partnerNodeTokens } from '@/platform/auth/partnerNode/partnerNodeTokens'
import { isCloud } from '@/platform/distribution/types'
import { useAuthStore } from '@/stores/authStore'

/**
 * The credential a Local prompt carries in `auth_token_comfy_org`: a
 * partner-node token for the workspace when the flag is on and the mint
 * succeeds, otherwise the workspace token unchanged.
 */
export async function queueAuthToken(
  workspaceToken: string | undefined,
  workspaceId: string | null
): Promise<string | undefined> {
  if (!workspaceToken || !workspaceId) return workspaceToken
  if (isCloud || isDesktopHostSignedIn()) return workspaceToken
  if (!useFeatureFlags().flags.partnerNodeTokenEnabled) return workspaceToken

  const authStore = useAuthStore()
  const ownerUid = authStore.currentUser?.uid
  if (!ownerUid) return workspaceToken

  const partnerNodeToken = await partnerNodeTokens.tokenFor({
    ownerUid,
    workspaceId,
    idToken: () => authStore.getIdToken()
  })
  return partnerNodeToken ?? workspaceToken
}
