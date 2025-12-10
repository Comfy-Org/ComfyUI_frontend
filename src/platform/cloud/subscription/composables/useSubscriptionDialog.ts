import { computed, defineAsyncComponent } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'subscription-required'

export const useSubscriptionDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { flags } = useFeatureFlags()

  const showStripeDialog = computed(
    () =>
      flags.subscriptionTiersEnabled &&
      isCloud &&
      window.__CONFIG__?.subscription_required
  )

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
        style: showStripeDialog.value
          ? 'width: min(1200px, 95vw); max-height: 90vh;'
          : 'width: min(800px, 90vw);',
        pt: showStripeDialog.value
          ? {
              root: {
                class: '!rounded-[32px] overflow-visible'
              },
              content: {
                class: '!p-0 bg-transparent'
              }
            }
          : undefined
      }
    })
  }

  return {
    show,
    hide
  }
}
