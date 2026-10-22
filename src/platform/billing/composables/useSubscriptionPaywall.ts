import type { SubscriptionDialogOptions } from '@/platform/billing/composables/types'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogsAccess } from '@/platform/billing/subscription/composables/billingDialogsAccess'
import { useSubscriptionDialogAccess } from '@/platform/billing/subscription/composables/subscriptionDialogAccess'

/**
 * Opens the paywall for the active billing rail: workspace billing shows the
 * pricing dialog directly, legacy billing goes through the
 * `subscription_required` gate of `showSubscriptionRequiredDialog`. While the
 * workspace type is still loading it waits for it, and drops the click if
 * the type never loads or the workspace changes meanwhile.
 */
export function useSubscriptionPaywall() {
  const { type, whenRoutingKnown } = useBillingContext()
  const { showSubscriptionRequiredDialog } = useBillingDialogsAccess()
  const subscriptionDialog = useSubscriptionDialogAccess()

  function showForRail(options?: SubscriptionDialogOptions): void {
    if (type.value === 'workspace') subscriptionDialog.show(options)
    else void showSubscriptionRequiredDialog(options)
  }

  function showSubscriptionDialog(options?: SubscriptionDialogOptions): void {
    if (type.value !== 'unknown') return showForRail(options)
    void whenRoutingKnown().then((known) => {
      if (known) showForRail(options)
    })
  }

  return { showSubscriptionDialog }
}
