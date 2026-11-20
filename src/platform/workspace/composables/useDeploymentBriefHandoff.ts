import { reportError } from '@comfyorg/telemetry/reportError'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'

type BriefHandoff = Pick<CustomDeploymentPitch, 'brief' | 'workflow'>

/** Hands a deployment brief to an agent, with its workflow as a download when the brief names one. */
export function useDeploymentBriefHandoff(handoff: () => BriefHandoff) {
  const toast = useToast()
  const { copyToClipboard } = useCopyToClipboard()

  function prepareDownload(): { download: () => void } | null {
    const { workflow } = handoff()
    if (!workflow) return { download: () => {} }
    const json = workflow.serialize()
    if (json === null) {
      reportHandoffFailure(
        new Error('The workflow the brief names is no longer loaded')
      )
      return null
    }
    const blob = new Blob([json], { type: 'application/json' })
    return { download: () => downloadBlob(workflow.fileName, blob) }
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
      const prepared = prepareDownload()
      if (
        !prepared ||
        !(await copyToClipboard(handoff().brief, { toastOnSuccess: false }))
      )
        return false
      prepared.download()
      return true
    } catch (error) {
      reportHandoffFailure(error)
      return false
    }
  }

  function openBriefIn(app: AgentApp): void {
    try {
      const prepared = prepareDownload()
      if (!prepared) return
      prepared.download()
      openAgentApp(app, handoff().brief)
    } catch (error) {
      reportHandoffFailure(error)
    }
  }

  return { copyBrief, openBriefIn }
}
