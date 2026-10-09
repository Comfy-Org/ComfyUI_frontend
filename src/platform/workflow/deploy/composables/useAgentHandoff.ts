import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import type { Distribution } from '@/platform/distribution/types'
import { DISTRIBUTION } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import {
  buildAgentHandoffDocument,
  handoffFileName
} from '@/platform/workflow/deploy/utils/agentHandoff'
import { deriveBuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

const UNTITLED_WORKFLOW_NAME = 'workflow'

export function useAgentHandoff(distribution: Distribution = DISTRIBUTION) {
  const workflowStore = useWorkflowStore()
  const toast = useToast()
  const modelToNodeStore = useModelToNodeStore()
  const { copyToClipboard } = useCopyToClipboard()

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

  function captureInputs(): BuildInputs {
    return snapshot().inputs
  }

  async function copyBrief(): Promise<boolean> {
    try {
      const { graph, inputs } = snapshot()
      const document = buildAgentHandoffDocument({
        distribution,
        inputs
      })
      if (!(await copyToClipboard(document, { toastOnSuccess: false }))) {
        reportError(new Error('The clipboard refused the brief'), {
          errorType: 'error_copying_deploy_agent_brief',
          surface: 'platform'
        })
        return false
      }
      if (distribution !== 'desktop') {
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
      toast.error(t('g.error'), {
        description: t('deployToComfyApi.briefFailed'),
        duration: 5000
      })
      return false
    }
  }

  return { captureInputs, copyBrief }
}
