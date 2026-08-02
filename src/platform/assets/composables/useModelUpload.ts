import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import UploadModelDialog from '@/platform/assets/components/UploadModelDialog.vue'
import UploadModelDialogHeader from '@/platform/assets/components/UploadModelDialogHeader.vue'
import type {
  UploadModelDialogContext,
  UploadModelSuccess
} from '@/platform/assets/composables/useUploadModelWizard'
import { createByomFlowId } from '@/platform/assets/utils/byomTelemetry'
import UploadModelUpgradeModal from '@/platform/assets/components/UploadModelUpgradeModal.vue'
import UploadModelUpgradeModalHeader from '@/platform/assets/components/UploadModelUpgradeModalHeader.vue'
import { useTelemetry } from '@/platform/telemetry'
import type { ByomSurface } from '@/platform/telemetry/types'
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
  uploadContext?: UploadModelDialogContext | UploadModelContextResolver,
  surface: ByomSurface = 'asset_browser'
) {
  const dialogStore = useDialogStore()
  const { flags } = useFeatureFlags()
  const isUploadButtonEnabled = computed(() => flags.modelUploadButtonEnabled)

  function resolveUploadContext() {
    return typeof uploadContext === 'function' ? uploadContext() : uploadContext
  }

  function showUploadDialog() {
    const context = resolveUploadContext()
    // Mint the correlation id here — the one point every entry surface funnels
    // through — so the wizard's later stages join back to this exact attempt
    // rather than to another attempt by the same user.
    const flowId = createByomFlowId()
    const gated = !flags.privateModelsEnabled

    // Emitted BEFORE the paywall branch, so total intent is the funnel's first
    // step and `gated` measures paywall conversion within a single step.
    useTelemetry()?.trackByomFunnel('dialog_opened', {
      flow_id: flowId,
      surface,
      gated,
      required_model_type: context?.requiredModelType
    })

    if (gated) {
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
          uploadContext: context,
          byomFlowId: flowId,
          byomSurface: surface,
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
