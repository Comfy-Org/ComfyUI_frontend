import { DISTRIBUTION, isCloud } from '@/platform/distribution/types'
import DeployToComfyApiCard from '@/platform/workflow/deploy/components/DeployToComfyApiCard.vue'
import { buildAgentHandoffDocument } from '@/platform/workflow/deploy/utils/agentHandoff'
import { deriveBuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogStore } from '@/stores/dialogStore'
import { appendJsonExt } from '@/utils/formatUtil'

const DIALOG_KEY = 'global-deploy-to-comfy-api'
const UNTITLED_WORKFLOW_NAME = 'workflow'

export function useDeployToComfyApiDialog() {
  const dialogStore = useDialogStore()
  const workflowStore = useWorkflowStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    const workflow = workflowStore.activeWorkflow
    const name =
      workflow?.filename.replace(/\.json$/i, '') || UNTITLED_WORKFLOW_NAME
    const snapshot = deriveBuildInputs(workflow?.activeState ?? {}, {
      name,
      fileName: appendJsonExt(name)
    })

    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: DeployToComfyApiCard,
      props: {
        inputs: snapshot,
        handoff: buildAgentHandoffDocument({
          distribution: DISTRIBUTION,
          inputs: snapshot
        }),
        requiresExport: isCloud,
        titleId: DIALOG_KEY,
        onDone: hide,
        onDismiss: hide
      },
      dialogComponentProps: {
        renderer: 'reka',
        dismissableMask: true,
        closeOnEscape: true,
        modal: true,
        headless: true,
        overlayClass: 'bg-black/55',
        contentClass:
          'w-[min(640px,calc(100vw-2rem))] border-none bg-transparent p-0 shadow-none sm:max-w-[640px]'
      }
    })
  }

  return { show, hide }
}
