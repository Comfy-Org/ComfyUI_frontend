import { defineAsyncComponent } from 'vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const DIALOG_KEY = 'subscription-required'

export const useSubscriptionDialog = () => {
  const { flags } = useFeatureFlags()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    const useWorkspaceVariant = flags.teamWorkspacesEnabled

    const component = useWorkspaceVariant
      ? defineAsyncComponent(
          () =>
            import('@/platform/cloud/subscription/components/SubscriptionRequiredDialogContentWorkspace.vue')
        )
      : defineAsyncComponent(
          () =>
            import('@/platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue')
        )

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component,
      props: {
        onClose: hide
      },
      dialogComponentProps: {
        style: 'width: min(1328px, 95vw); max-height: 958px;',
        pt: {
          root: {
            class: 'rounded-2xl bg-transparent h-full'
          },
          content: {
            class:
              '!p-0 rounded-2xl border border-border-default bg-base-background/60 backdrop-blur-md shadow-[0_25px_80px_rgba(5,6,12,0.45)] h-full'
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
