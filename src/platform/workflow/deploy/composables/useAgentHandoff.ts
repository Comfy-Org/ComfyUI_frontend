import { downloadBlob } from '@/base/common/downloadUtil'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import { DISTRIBUTION, isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import {
  buildAgentHandoffDocument,
  handoffFileName
} from '@/platform/workflow/deploy/utils/agentHandoff'
import { deriveBuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

const UNTITLED_WORKFLOW_NAME = 'workflow'

/**
 * The brief a coding agent gets for the open workflow. Both the inputs and
 * the document are read off the graph at the moment they are asked for, so
 * the file that travels with a Cloud brief is the graph the brief describes.
 */
export function useAgentHandoff() {
  const workflowStore = useWorkflowStore()
  const toastStore = useToastStore()
  const modelToNodeStore = useModelToNodeStore()
  const { copyToClipboard } = useCopyToClipboard()

  /**
   * Every model input of every known loader, by node class. Read from the
   * providers themselves: the registry's node-type record keeps one input
   * per class, and a loader such as INPAINT_LoadFooocusInpaint has two.
   */
  function modelInputsByLoader(): ReadonlyMap<string, readonly string[]> {
    modelToNodeStore.registerDefaults()
    const inputs = new Map<string, string[]>()
    for (const providers of Object.values(modelToNodeStore.modelToNodeMap)) {
      for (const { nodeDef, key } of providers ?? []) {
        if (!key) continue
        const keys = inputs.get(nodeDef.name) ?? []
        if (!keys.includes(key)) inputs.set(nodeDef.name, [...keys, key])
      }
    }
    return inputs
  }

  function snapshot() {
    const workflow = workflowStore.activeWorkflow
    workflow?.changeTracker.prepareForSave()
    const name =
      workflow?.filename.replace(/\.json$/i, '') || UNTITLED_WORKFLOW_NAME
    const graph = workflow?.activeState ?? {}
    const loaders = modelInputsByLoader()
    return {
      graph,
      inputs: deriveBuildInputs(
        graph,
        { name, fileName: handoffFileName(name) },
        (nodeType) => loaders.get(nodeType) ?? []
      )
    }
  }

  /**
   * Captures the open workflow, committing any edit still in a focused field,
   * and reads what it contributes to a Build.
   */
  function captureInputs(): BuildInputs {
    return snapshot().inputs
  }

  /**
   * The clipboard write comes first: it needs the click's user activation,
   * which a download prompt would spend. The Cloud file is written under the
   * name the brief gives it, without the export filename prompt, for the
   * same reason.
   */
  async function copyBrief(): Promise<boolean> {
    try {
      const { graph, inputs } = snapshot()
      const document = buildAgentHandoffDocument({
        distribution: DISTRIBUTION,
        inputs
      })
      if (!(await copyToClipboard(document, { toastOnSuccess: false }))) {
        reportError(new Error('The clipboard refused the brief'), {
          errorType: 'error_copying_deploy_agent_brief',
          surface: 'platform'
        })
        return false
      }
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
      reportError(error, {
        errorType: 'error_copying_deploy_agent_brief',
        surface: 'platform'
      })
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('deployToComfyApi.briefFailed'),
        life: 5000
      })
      return false
    }
  }

  return { captureInputs, copyBrief }
}
