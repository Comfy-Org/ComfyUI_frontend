import { defineAsyncComponent } from 'vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'subscription-required'

export const useSubscriptionDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: defineAsyncComponent(
        () =>
          import(
            '@/platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue'
          )
      ),
      props: {
        onClose: hide
      },
      dialogComponentProps: {
        style: 'width: 700px;'
      }
    })
  }

  return {
    show,
    hide
  }
}
