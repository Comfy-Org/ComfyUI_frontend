import type { SubscriptionDialogOptions } from '@/composables/billing/types'

interface SubscriptionDialogAccess {
  show(options?: SubscriptionDialogOptions): void
}

/** `useSubscriptionDialog` for the dialogs it opens, which cannot import it back. */
export let useSubscriptionDialogAccess: () => SubscriptionDialogAccess

/** Called by `useSubscriptionDialog` when it loads. */
export function provideSubscriptionDialog(
  useDialog: () => SubscriptionDialogAccess
): void {
  useSubscriptionDialogAccess = useDialog
}
