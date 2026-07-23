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

// Contents bring their own width and padding — shrink-wrap the chrome and
// zero the section padding (the PrimeVue `pt` overrides this replaces).
const uploadDialogComponentProps = {
  renderer: 'reka',
  contentClass: 'w-fit max-w-[calc(100vw-1rem)]',
  headerClass: 'py-0 pl-0',
  bodyClass: 'min-h-0 overflow-hidden p-0'
} as const

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
        dialogComponentProps: uploadDialogComponentProps
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
        dialogComponentProps: uploadDialogComponentProps
      })
    }
  }
  return { isUploadButtonEnabled, showUploadDialog }
}
