import { workspaceDialogProps } from '@/platform/workspace/components/dialogs/workspaceDialogProps'
import { useDialogStore } from '@/stores/dialogStore'

export async function showCancelSubscriptionDialog(cancelAt?: string) {
  const { default: component } =
    await import('@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue')
  return useDialogStore().showDialog({
    key: 'cancel-subscription',
    component,
    props: { cancelAt },
    dialogComponentProps: {
      ...workspaceDialogProps
    }
  })
}
