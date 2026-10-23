import type { ExtensionDialogService } from '@/services/dialogServiceTypes'

type BillingDialogsAccess = Pick<
  ExtensionDialogService,
  'showSubscriptionRequiredDialog' | 'showDowngradeToPersonalDialog'
>

/** `useBillingDialogs` for the dialogs it opens, which cannot import it back. */
export let useBillingDialogsAccess: () => BillingDialogsAccess

/** Called by `useBillingDialogs` when it loads. */
export function provideBillingDialogs(
  useDialogs: () => BillingDialogsAccess
): void {
  useBillingDialogsAccess = useDialogs
}
