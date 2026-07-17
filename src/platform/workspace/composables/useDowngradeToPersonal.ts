import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

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
  const billingOperationStore = useBillingOperationStore()
  const { userEmail } = useCurrentUser()

  const removableMembers = computed(() => {
    const hasFlag = members.value.some((m) => m.isOriginalOwner)
    if (hasFlag) return members.value.filter((m) => !m.isOriginalOwner)
    const email = userEmail.value?.toLowerCase() ?? null
    return members.value.filter(
      (m) => m.role !== 'owner' && m.email.toLowerCase() !== email
    )
  })

  const hasOtherMembers = computed(() => removableMembers.value.length > 0)

  async function refreshMembers(): Promise<void> {
    await workspaceStore.fetchMembers()
  }

  async function downgradeToPersonal(planSlug: string): Promise<void> {
    const preview = await previewSubscribe(planSlug)
    if (!preview?.allowed) {
      throw new Error(preview?.reason || t('subscription.downgrade.notAllowed'))
    }

    const membersToRemove = removableMembers.value
    for (const member of membersToRemove) {
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

    if (response.status === 'needs_payment_method') {
      if (!response.payment_method_url) {
        throw new Error(t('subscription.downgrade.paymentMethodRequired'))
      }
      const paymentTab = window.open(response.payment_method_url, '_blank')
      if (!paymentTab) {
        throw new Error(t('subscription.downgrade.paymentPageBlocked'))
      }
      void billingOperationStore.startOperation(
        response.billing_op_id,
        'subscription'
      )
      return
    }

    if (response.status === 'pending_payment') {
      void billingOperationStore.startOperation(
        response.billing_op_id,
        'subscription'
      )
    }
  }

  return {
    removableMembers,
    hasOtherMembers,
    refreshMembers,
    downgradeToPersonal
  }
}
