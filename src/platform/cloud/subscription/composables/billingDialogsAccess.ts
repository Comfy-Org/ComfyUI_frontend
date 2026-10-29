import type { SubscriptionDialogOptions } from '@/composables/billing/types'
import type { ExtensionDialogService } from '@/services/dialogServiceTypes'

type BillingDialogsAccess = Pick<
  ExtensionDialogService,
  'showDowngradeToPersonalDialog'
> & {
  showSubscriptionRequiredDialog(
    options?: SubscriptionDialogOptions
  ): Promise<boolean>
}

/** `useBillingDialogs` for the dialogs it opens, which cannot import it back. */
export let useBillingDialogsAccess: () => BillingDialogsAccess

/** Called by `useBillingDialogs` when it loads. */
export function provideBillingDialogs(
  useDialogs: () => BillingDialogsAccess
): void {
  useBillingDialogsAccess = useDialogs
}
