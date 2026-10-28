import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useCloudNotificationDialog } from '@/platform/cloud/notification/composables/useCloudNotificationDialog'
import { useComfyHubPublishDialog } from '@/platform/workflow/sharing/composables/useComfyHubPublishDialog'
import { useWorkspaceDialogs } from '@/platform/account/composables/useWorkspaceDialogs'
import type { ExtensionDialogService } from '@/services/dialogService'
import { useDialogService } from '@/services/dialogService'

export function createExtensionDialogService(): ExtensionDialogService {
  const { showPublishDialog } = useComfyHubPublishDialog()
  // The composable reports whether the subscription dialog opened; extensions
  // keep the stable void-returning signature.
  const { showSubscriptionRequiredDialog, ...billingDialogs } =
    useBillingDialogs()
  return {
    ...useDialogService(),
    ...useAuthDialogs(),
    ...billingDialogs,
    showSubscriptionRequiredDialog: async (options) => {
      await showSubscriptionRequiredDialog(options)
    },
    ...useWorkspaceDialogs(),
    ...useCloudNotificationDialog(),
    showPublishDialog
  }
}
