import { useFeatureFlags } from '@/composables/useFeatureFlags'
import UploadModelDialog from '@/platform/assets/components/UploadModelDialog.vue'
import UploadModelDialogHeader from '@/platform/assets/components/UploadModelDialogHeader.vue'
import UploadModelUpgradeModal from '@/platform/assets/components/UploadModelUpgradeModal.vue'
import UploadModelUpgradeModalHeader from '@/platform/assets/components/UploadModelUpgradeModalHeader.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useDialogStore } from '@/stores/dialogStore'
import type { UseAsyncStateReturn } from '@vueuse/core'
import { computed } from 'vue'

export function useModelUpload(
  execute?: UseAsyncStateReturn<AssetItem[], [], true>['execute']
) {
  const dialogStore = useDialogStore()
  const { flags } = useFeatureFlags()
  const isUploadButtonEnabled = computed(() => flags.modelUploadButtonEnabled)

  function showUploadDialog() {
    if (!flags.privateModelsEnabled) {
      // Show upgrade modal if private models are disabled
      dialogStore.showDialog({
        key: 'upload-model-upgrade',
        headerComponent: UploadModelUpgradeModalHeader,
        component: UploadModelUpgradeModal,
        dialogComponentProps: {
          pt: {
            header: 'py-0! pl-0!',
            content: 'p-0!'
          }
        }
      })
    } else {
      // Show regular upload modal
      dialogStore.showDialog({
        key: 'upload-model',
        headerComponent: UploadModelDialogHeader,
        component: UploadModelDialog,
        props: {
          onUploadSuccess: async () => {
            await execute?.()
          }
        },
        dialogComponentProps: {
          pt: {
            header: 'py-0! pl-0!',
            content: 'p-0!'
          }
        }
      })
    }
  }
  return { isUploadButtonEnabled, showUploadDialog }
}
