import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * Identify the member who must never be removed on downgrade.
 *
 * The cloud API exposes no creator field, so this protects every owner plus
 * the acting user. FE-770 infers the creator as the earliest-joined member
 * (`originalOwnerId`); whichever PR lands second must unify both predicates
 * on that single source. BE-1337 will expose an explicit original-owner
 * determination.
 */
function isCreator(
  member: WorkspaceMember,
  currentUserEmail: string | null
): boolean {
  return (
    member.role === 'owner' ||
    member.email.toLowerCase() === currentUserEmail?.toLowerCase()
  )
}

/**
 * Orchestrates a team-plan downgrade to a personal plan (FE-977).
 *
 * The transition is validated via `previewSubscribe` before any member is
 * removed; then every member except the creator is removed and the tier
 * change is initiated. `needs_payment_method` / `pending_payment` subscribe
 * outcomes are handled like `useSubscriptionCheckout` (payment-method tab +
 * billing-operation polling).
 *
 * BE seam: the automatic "remove all members on downgrade + send email"
 * side-effect does not exist server-side yet (email is BE-owned). Until a
 * dedicated downgrade endpoint lands (BE-1337), the FE orchestrates
 * `removeMember` calls and initiates the tier change via the existing
 * subscribe path.
 */
export function useDowngradeToPersonal() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)
  const { userEmail } = useCurrentUser()
  const { subscribe, previewSubscribe } = useBillingContext()
  const billingOperationStore = useBillingOperationStore()

  const removableMembers = computed(() =>
    members.value.filter(
      (member) => !isCreator(member, userEmail.value ?? null)
    )
  )

  const hasOtherMembers = computed(() => removableMembers.value.length > 0)

  async function refreshMembers(): Promise<void> {
    await workspaceStore.fetchMembers()
  }

  async function downgradeToPersonal(planSlug: string): Promise<void> {
    const preview = await previewSubscribe(planSlug)
    if (!preview?.allowed) {
      throw new Error(preview?.reason || t('subscription.downgrade.notAllowed'))
    }

    for (const member of removableMembers.value) {
      await workspaceStore.removeMember(member.id)
    }

    const response = await subscribe(
      planSlug,
      `${getComfyPlatformBaseUrl()}/payment/success`,
      `${getComfyPlatformBaseUrl()}/payment/failed`
    )
    if (!response) {
      throw new Error(t('subscription.downgrade.failed'))
    }

    if (response.status === 'needs_payment_method') {
      if (!response.payment_method_url) {
        throw new Error(t('subscription.downgrade.paymentMethodRequired'))
      }
      const paymentTab = window.open(response.payment_method_url, '_blank')
      if (!paymentTab) {
        throw new Error(t('subscription.downgrade.paymentPageBlocked'))
      }
      billingOperationStore.startOperation(
        response.billing_op_id,
        'subscription'
      )
      return
    }

    if (response.status === 'pending_payment') {
      billingOperationStore.startOperation(
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
