import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { useCloudNotificationDialog } from '@/platform/cloud/notification/composables/useCloudNotificationDialog'
import { useComfyHubPublishDialog } from '@/platform/workflow/sharing/composables/useComfyHubPublishDialog'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'
import type { ExtensionDialogService } from '@/services/dialogService'
import { useDialogService } from '@/services/dialogService'

export function createExtensionDialogService(): ExtensionDialogService {
  const { showPublishDialog } = useComfyHubPublishDialog()
  return {
    ...useDialogService(),
    ...useAuthDialogs(),
    ...useBillingDialogs(),
    ...useWorkspaceDialogs(),
    ...useCloudNotificationDialog(),
    showPublishDialog
  }
}
