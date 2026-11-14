import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  desktopHostPartnerNodeToken,
  desktopHostSessionRevision,
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

/** The workspace's partner-node token for `auth_token_comfy_org`, or the workspace token when none is available or the Desktop session changed meanwhile. */
export async function queueAuthToken(
  workspaceToken: string | undefined,
  workspaceId: string | null
): Promise<string | undefined> {
  if (!workspaceToken || !workspaceId || isCloud) return workspaceToken
  if (!useFeatureFlags().flags.partnerNodeTokenEnabled) return workspaceToken

  const startedUnder = desktopHostSessionRevision()
  const sessionChanged = () => desktopHostSessionRevision() !== startedUnder

  const fromDesktop = await desktopHostPartnerNodeToken(workspaceId)
  if (fromDesktop) return fromDesktop
  if (sessionChanged()) return workspaceToken

  const target = mintTarget(workspaceId)
  if (!target) return workspaceToken
  const minted = await partnerNodeTokens.tokenFor(target)
  if (sessionChanged()) return workspaceToken
  return minted ?? workspaceToken
}
