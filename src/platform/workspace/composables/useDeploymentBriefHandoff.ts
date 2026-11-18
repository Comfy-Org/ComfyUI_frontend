import { reportError } from '@comfyorg/telemetry/reportError'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'

type BriefHandoff = Pick<CustomDeploymentPitch, 'brief' | 'workflowFileName'>

/** Hands a deployment brief to an agent, with the open workflow as a download when the brief names one. */
export function useDeploymentBriefHandoff(handoff: () => BriefHandoff) {
  const workflowStore = useWorkflowStore()
  const toast = useToast()
  const { copyToClipboard } = useCopyToClipboard()

  function workflowDownload(): (() => void) | null {
    const { workflowFileName } = handoff()
    if (!workflowFileName) return null
    const workflow = workflowStore.activeWorkflow
    workflow?.changeTracker.prepareForSave()
    const blob = new Blob(
      [JSON.stringify(workflow?.activeState ?? {}, null, 2)],
      { type: 'application/json' }
    )
    return () => downloadBlob(workflowFileName, blob)
  }

  function reportHandoffFailure(error: unknown) {
    reportError(error, {
      errorType: 'error_preparing_custom_deployment_agent_prompt',
      surface: 'platform'
    })
    toast.error(t('g.error'), {
      description: t('deployToComfyApi.briefFailed')
    })
  }

  async function copyBrief(): Promise<boolean> {
    try {
      const download = workflowDownload()
      if (!(await copyToClipboard(handoff().brief, { toastOnSuccess: false })))
        return false
      download?.()
      return true
    } catch (error) {
      reportHandoffFailure(error)
      return false
    }
  }

  function openBriefIn(app: AgentApp): void {
    try {
      workflowDownload()?.()
      openAgentApp(app, handoff().brief)
    } catch (error) {
      reportHandoffFailure(error)
    }
  }

  return { copyBrief, openBriefIn }
}
