import type { SubscriptionDialogOptions } from '@/platform/billing/composables/types'
import type { ExtensionDialogService } from '@/services/dialogServiceTypes'

type BillingDialogsAccess = Pick<
  ExtensionDialogService,
  'showDowngradeToPersonalDialog'
> & {
  /**
   * Resolves whether the dialog actually opened. In-app callers branch on
   * that; the extension-facing signature stays `Promise<void>` so it remains
   * assignable to the callbacks extensions already wrote against it.
   */
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
