import { useDialogStore } from '@/stores/dialogStore'

const workspaceDialogPt = {
  headless: true,
  pt: {
    header: { class: 'p-0! hidden' },
    content: { class: 'p-0! m-0! rounded-2xl' },
    root: { class: 'rounded-2xl' }
  }
} as const

export async function showCancelSubscriptionDialog(cancelAt?: string) {
  const { default: component } =
    await import('@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue')
  return useDialogStore().showDialog({
    key: 'cancel-subscription',
    component,
    props: { cancelAt },
    dialogComponentProps: {
      ...workspaceDialogPt
    }
  })
}
