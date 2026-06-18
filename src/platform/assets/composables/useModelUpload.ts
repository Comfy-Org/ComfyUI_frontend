import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import UploadModelDialog from '@/platform/assets/components/UploadModelDialog.vue'
import UploadModelDialogHeader from '@/platform/assets/components/UploadModelDialogHeader.vue'
import type {
  UploadModelDialogContext,
  UploadModelSuccess
} from '@/platform/assets/composables/useUploadModelWizard'
import UploadModelUpgradeModal from '@/platform/assets/components/UploadModelUpgradeModal.vue'
import UploadModelUpgradeModalHeader from '@/platform/assets/components/UploadModelUpgradeModalHeader.vue'
import { useDialogStore } from '@/stores/dialogStore'

type UploadModelContextResolver = () => UploadModelDialogContext | undefined

export function useModelUpload(
  onUploadSuccess?: (result: UploadModelSuccess) => Promise<unknown> | void,
  uploadContext?: UploadModelDialogContext | UploadModelContextResolver
) {
  const dialogStore = useDialogStore()
  const { flags } = useFeatureFlags()
  const isUploadButtonEnabled = computed(() => flags.modelUploadButtonEnabled)

  function resolveUploadContext() {
    return typeof uploadContext === 'function' ? uploadContext() : uploadContext
  }

  function showUploadDialog() {
    if (!flags.privateModelsEnabled) {
      dialogStore.showDialog({
        key: 'upload-model-upgrade',
        headerComponent: UploadModelUpgradeModalHeader,
        component: UploadModelUpgradeModal,
        dialogComponentProps: {
          pt: {
            header: 'py-0! pl-0!',
            content: 'p-0! overflow-y-hidden!'
          }
        }
      })
    } else {
      dialogStore.showDialog({
        key: 'upload-model',
        headerComponent: UploadModelDialogHeader,
        component: UploadModelDialog,
        props: {
          uploadContext: resolveUploadContext(),
          onUploadSuccess: async (result: UploadModelSuccess) => {
            await onUploadSuccess?.(result)
          }
        },
        dialogComponentProps: {
          pt: {
            header: 'py-0! pl-0!',
            content: 'p-0! overflow-y-hidden!'
          }
        }
      })
    }
  }
  return { isUploadButtonEnabled, showUploadDialog }
}
