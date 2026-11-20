import { reportError } from '@comfyorg/telemetry/reportError'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { DISTRIBUTION } from '@/platform/distribution/types'
import type { Distribution } from '@/platform/distribution/types'
import { runOnCloudPrompt } from '@/platform/openOnCloud/runOnCloudPrompt'
import { handoffFileName } from '@/platform/workflow/deploy/utils/agentHandoff'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useUserStore } from '@/stores/userStore'

let isSaving = false

export function useRunOnCloudHandoff(
  distribution: Distribution = DISTRIBUTION
) {
  const workflowStore = useWorkflowStore()
  const userStore = useUserStore()
  const toast = useToast()
  const { copyToClipboard } = useCopyToClipboard()
  const save = useErrorHandling().wrapWithErrorHandlingAsync(
    useWorkflowService().saveWorkflow
  )

  function needsSave(): boolean {
    const workflow = workflowStore.activeWorkflow
    return (
      distribution !== 'cloud' &&
      !!workflow &&
      (!workflow.isPersisted || workflow.isModified)
    )
  }

  async function saveActiveWorkflow(): Promise<boolean> {
    const workflow = workflowStore.activeWorkflow
    if (!workflow || !needsSave()) return true
    if (isSaving) return false
    isSaving = true
    try {
      if ((await save(workflow)) !== true) return false
    } finally {
      isSaving = false
    }
    return (
      workflowStore.activeWorkflow === workflow &&
      workflow.isPersisted &&
      !workflow.isModified
    )
  }

  function prepareHandoff() {
    const workflow = workflowStore.activeWorkflow
    workflow?.changeTracker.prepareForSave()
    if (distribution === 'cloud') {
      const fileName = handoffFileName(
        workflow?.filename.replace(/\.json$/i, '') || 'workflow'
      )
      return {
        brief: runOnCloudPrompt({ kind: 'download', fileName }),
        download: {
          fileName,
          blob: new Blob(
            [JSON.stringify(workflow?.activeState ?? {}, null, 2)],
            {
              type: 'application/json'
            }
          )
        }
      }
    }
    if (!workflow?.isPersisted || workflow.isModified) {
      toast.error(t('openOnCloud.agentMenu.saveFirst'))
      return null
    }
    return {
      brief: runOnCloudPrompt({
        kind: 'server',
        workflowPath: workflow.path,
        serverUrl: new URL(api.fileURL('/'), window.location.origin).href,
        user: userStore.isMultiUserServer ? api.user : undefined
      }),
      download: null
    }
  }

  function reportHandoffFailure(error: unknown) {
    reportError(error, {
      errorType: 'error_preparing_run_on_cloud_agent_prompt',
      surface: 'platform'
    })
    toast.error(t('g.error'), {
      description: t('deployToComfyApi.briefFailed')
    })
  }

  async function prepareBrief(): Promise<string | null> {
    if (needsSave() && !(await saveActiveWorkflow())) return null
    try {
      const handoff = prepareHandoff()
      if (!handoff) return null
      if (handoff.download)
        downloadBlob(handoff.download.fileName, handoff.download.blob)
      return handoff.brief
    } catch (error) {
      reportHandoffFailure(error)
      return null
    }
  }

  async function copyBrief(): Promise<boolean> {
    if (needsSave() && !(await saveActiveWorkflow())) return false
    try {
      const handoff = prepareHandoff()
      if (
        !handoff ||
        !(await copyToClipboard(handoff.brief, { toastOnSuccess: false }))
      )
        return false
      if (handoff.download)
        downloadBlob(handoff.download.fileName, handoff.download.blob)
      return true
    } catch (error) {
      reportHandoffFailure(error)
      return false
    }
  }

  async function openBriefIn(app: AgentApp): Promise<void> {
    if (needsSave() && !(await saveActiveWorkflow())) return
    try {
      const handoff = prepareHandoff()
      if (!handoff) return
      if (handoff.download)
        downloadBlob(handoff.download.fileName, handoff.download.blob)
      const copying = copyToClipboard(handoff.brief, {
        toastOnSuccess: false,
        toastOnError: false
      })
      openAgentApp(app, handoff.brief)
      if (await copying)
        toast.info(t('openOnCloud.agentMenu.promptCopiedForSignIn'))
    } catch (error) {
      reportHandoffFailure(error)
    }
  }

  return { needsSave, saveActiveWorkflow, prepareBrief, copyBrief, openBriefIn }
}
