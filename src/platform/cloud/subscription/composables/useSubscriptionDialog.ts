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
        style: 'width: min(1200px, 95vw); max-height: 90vh;',
        pt: {
          root: {
            class: '!rounded-[32px] overflow-visible'
          },
          content: {
            class: '!p-0 bg-transparent'
          }
        }
      }
    })
  }

  return {
    show,
    hide
  }
}
