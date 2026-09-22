import { downloadBlob } from '@/base/common/downloadUtil'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import { DISTRIBUTION, isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { buildAgentHandoffDocument } from '@/platform/workflow/deploy/utils/agentHandoff'
import { deriveBuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { appendJsonExt } from '@/utils/formatUtil'

const UNTITLED_WORKFLOW_NAME = 'workflow'

/**
 * The brief a coding agent gets for the open workflow. Both the inputs and
 * the document are read off the graph at the moment they are asked for, so
 * the file that travels with a Cloud brief is the graph the brief describes.
 */
export function useAgentHandoff() {
  const workflowStore = useWorkflowStore()
  const toastStore = useToastStore()
  const { copyToClipboard } = useCopyToClipboard()

  function snapshot() {
    const workflow = workflowStore.activeWorkflow
    const name =
      workflow?.filename.replace(/\.json$/i, '') || UNTITLED_WORKFLOW_NAME
    const graph = workflow?.activeState ?? {}
    return {
      graph,
      inputs: deriveBuildInputs(graph, { name, fileName: appendJsonExt(name) })
    }
  }

  function currentInputs(): BuildInputs {
    return snapshot().inputs
  }

  /**
   * The clipboard write comes first: it needs the click's user activation,
   * which a download prompt would spend. The Cloud file is written under the
   * name the brief gives it, without the export filename prompt, for the
   * same reason.
   */
  async function copyBrief(): Promise<boolean> {
    const { graph, inputs } = snapshot()
    const document = buildAgentHandoffDocument({
      distribution: DISTRIBUTION,
      inputs
    })
    try {
      if (!(await copyToClipboard(document, { toastOnSuccess: false })))
        return false
      if (isCloud) {
        downloadBlob(
          inputs.workflowFileName,
          new Blob([JSON.stringify(graph, null, 2)], {
            type: 'application/json'
          })
        )
      }
      return true
    } catch (error) {
      reportError(error, { errorType: 'error_copying_deploy_agent_brief' })
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('deployToComfyApi.briefFailed'),
        life: 5000
      })
      return false
    }
  }

  return { currentInputs, copyBrief }
}
