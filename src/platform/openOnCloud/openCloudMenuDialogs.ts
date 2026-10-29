import type {
  CloudMissingModel,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { useDialogStore } from '@/stores/dialogStore'

const CONVERT_DIALOG_KEY = 'global-convert-to-run-on-comfy-cloud'
const UPLOAD_DIALOG_KEY = 'global-upload-models-to-comfy-cloud'

const dialogComponentProps = {
  dismissOnPointerDownOutside: true,
  headless: true
}

/** Opens Run on Comfy Cloud, which hands the workflow to the local agent. */
export async function openConvertDialog(
  gaps: CloudWorkflowGaps
): Promise<void> {
  const { default: ConvertWithAgentCard } =
    await import('@/platform/openOnCloud/components/ConvertWithAgentCard.vue')
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key: CONVERT_DIALOG_KEY })
  dialogStore.showDialog({
    key: CONVERT_DIALOG_KEY,
    component: ConvertWithAgentCard,
    props: { titleId: CONVERT_DIALOG_KEY, gaps, onDone: hide, onDismiss: hide },
    dialogComponentProps
  })
}

/** Opens the dialog that uploads the models Comfy Cloud lacks. */
export async function openUploadModelsDialog(
  models: CloudMissingModel[]
): Promise<void> {
  const { default: UploadModelsCard } =
    await import('@/platform/openOnCloud/components/UploadModelsCard.vue')
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key: UPLOAD_DIALOG_KEY })
  dialogStore.showDialog({
    key: UPLOAD_DIALOG_KEY,
    component: UploadModelsCard,
    props: {
      titleId: UPLOAD_DIALOG_KEY,
      models,
      onDone: hide,
      onDismiss: hide
    },
    dialogComponentProps
  })
}
