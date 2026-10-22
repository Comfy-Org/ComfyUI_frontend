import { reportError } from '@/platform/telemetry/reportError'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  canDesktopHostMintPartnerNodeToken,
  desktopHostPartnerNodeToken,
  desktopHostUser,
  desktopHostWorkspaceToken
} from '@/platform/auth/desktopHost/desktopHostSession'
import type { PartnerNodeTokenTarget } from '@/platform/auth/partnerNode/partnerNodeTokenSource'
import { partnerNodeTokens } from '@/platform/auth/partnerNode/partnerNodeTokens'
import { isCloud } from '@/platform/distribution/types'
import { useAuthStore } from '@/stores/authStore'

/**
 * Who mints for `workspaceId`: a signed-in host session with its OAuth access
 * token for that workspace, else the Firebase user with its ID token.
 */
function mintTarget(workspaceId: string): PartnerNodeTokenTarget | undefined {
  const hostUser = desktopHostUser.value
  if (hostUser) {
    return {
      ownerUid: hostUser.id,
      workspaceId,
      credential: () => desktopHostWorkspaceToken(workspaceId)
    }
  }
  const authStore = useAuthStore()
  const ownerUid = authStore.currentUser?.uid
  if (!ownerUid) return undefined
  return { ownerUid, workspaceId, credential: () => authStore.getIdToken() }
}

/** Returns a Local prompt credential; native mint failures return undefined. */
export async function queueAuthToken(
  workspaceToken: string | undefined,
  workspaceId: string | null
): Promise<string | undefined> {
  if (!workspaceToken || !workspaceId || isCloud) return workspaceToken
  if (!useFeatureFlags().flags.partnerNodeTokenEnabled) return workspaceToken

  if (desktopHostUser.value && canDesktopHostMintPartnerNodeToken()) {
    const result = await desktopHostPartnerNodeToken(workspaceId)
    if (result.status === 'failed')
      reportError(result.error, {
        surface: 'auth',
        errorType: 'failure_minting_partner_node_token'
      })
    return result.status === 'ready' ? result.token : undefined
  }

  const target = mintTarget(workspaceId)
  if (!target) return workspaceToken
  return (await partnerNodeTokens.tokenFor(target)) ?? workspaceToken
}
