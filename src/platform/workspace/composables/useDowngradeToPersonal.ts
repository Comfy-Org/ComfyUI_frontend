import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type {
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface DowngradeToPersonalResult {
  preview: PreviewSubscribeResponse
  response: SubscribeResponse
}

/**
 * Team-plan downgrade to personal: validate via `previewSubscribe`, remove
 * every member except the original owner, then initiate the tier change.
 * BE seam (BE-1337): removal email and an atomic downgrade endpoint are
 * BE-owned; until then the FE orchestrates the two steps non-atomically.
 */
export function useDowngradeToPersonal() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)
  const { subscribe, previewSubscribe } = useBillingContext()
  const { userEmail } = useCurrentUser()
  const { permissions } = useWorkspaceUI()

  const removableMembers = computed(() => {
    const hasFlag = members.value.some((m) => m.isOriginalOwner)
    if (hasFlag) return members.value.filter((m) => !m.isOriginalOwner)
    const email = userEmail.value?.toLowerCase() ?? null
    return members.value.filter(
      (m) => m.role !== 'owner' && m.email.toLowerCase() !== email
    )
  })

  const hasOtherMembers = computed(() => removableMembers.value.length > 0)

  function ensureCanDowngrade(): void {
    if (!permissions.value.canDowngradeToPersonal) {
      throw new Error(t('subscription.downgrade.notAllowed'))
    }
  }

  async function refreshMembers(): Promise<void> {
    if (!permissions.value.canManageSubscription) {
      throw new Error(t('subscription.downgrade.notAllowed'))
    }
    await workspaceStore.fetchMembers()
    ensureCanDowngrade()
  }

  async function downgradeToPersonal(
    planSlug: string
  ): Promise<DowngradeToPersonalResult> {
    ensureCanDowngrade()
    const preview = await previewSubscribe(planSlug)
    if (!preview?.allowed) {
      throw new Error(preview?.reason || t('subscription.downgrade.notAllowed'))
    }
    ensureCanDowngrade()

    const membersToRemove = removableMembers.value
    for (const member of membersToRemove) {
      ensureCanDowngrade()
      try {
        await workspaceStore.removeMember(member.id)
      } catch (error) {
        throw new Error(
          t('subscription.downgrade.memberRemovalFailed', {
            email: member.email
          }),
          { cause: error }
        )
      }
    }

    ensureCanDowngrade()
    const response = await subscribe(planSlug, {
      returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
      cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`
    })
    if (!response) {
      throw new Error(
        membersToRemove.length > 0
          ? t('subscription.downgrade.failedAfterMemberRemoval')
          : t('subscription.downgrade.failed')
      )
    }

    return { preview, response }
  }

  return {
    removableMembers,
    hasOtherMembers,
    refreshMembers,
    downgradeToPersonal
  }
}
