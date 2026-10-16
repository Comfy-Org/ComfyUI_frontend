import { z } from 'zod'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isDesktop } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { createUuidv4 } from '@/utils/uuid'

const HANDOFF_DEADLINE_MS = 60_000
const zHandoffReady = z.object({
  type: z.literal('comfy-build-handoff:ready'),
  nonce: z.string()
})

function platformBuildImportUrl(nonce?: string): string {
  const url = new URL('/profile/builds/new', getComfyPlatformBaseUrl())
  url.searchParams.set('step', 'import')
  if (nonce) url.searchParams.set('handoff', nonce)
  return url.href
}

function reportPreparationFailure(error: unknown): void {
  reportError(error, {
    errorType: 'error_preparing_platform_build_handoff',
    surface: 'platform'
  })
  useToast().error(t('deployToComfyApi.workflowTransferFailed'), {
    duration: 8000
  })
}

async function prepareWorkflow(): Promise<ComfyWorkflowJSON | undefined> {
  try {
    const workflow = await validateComfyWorkflow(
      useWorkflowService().prepareWorkflowJson()
    )
    if (!workflow) {
      reportPreparationFailure('The workflow could not be validated')
      return undefined
    }
    return workflow
  } catch (error) {
    reportPreparationFailure(error)
    return undefined
  }
}

async function downloadWorkflowFile(filename: string): Promise<boolean> {
  const workflow = await prepareWorkflow()
  if (!workflow) return false
  try {
    downloadBlob(
      filename,
      new Blob([JSON.stringify(workflow, null, 2)], {
        type: 'application/json'
      })
    )
    return true
  } catch (error) {
    reportPreparationFailure(error)
    return false
  }
}

function armHandoff(tab: Window, nonce: string, filename: string): void {
  const platformOrigin = new URL(getComfyPlatformBaseUrl()).origin
  const prepared = prepareWorkflow()
  function stop() {
    window.removeEventListener('message', onMessage)
    clearTimeout(deadline)
  }
  function onMessage(event: MessageEvent) {
    if (event.source !== tab || event.origin !== platformOrigin) return
    const ready = zHandoffReady.safeParse(event.data)
    if (!ready.success || ready.data.nonce !== nonce) return
    stop()
    void prepared
      .then((workflow) => {
        if (workflow && !tab.closed)
          tab.postMessage(
            {
              type: 'comfy-build-handoff:workflow',
              nonce,
              filename,
              workflow
            },
            platformOrigin
          )
      })
      .catch(reportPreparationFailure)
  }
  const deadline = setTimeout(stop, HANDOFF_DEADLINE_MS)
  window.addEventListener('message', onMessage)
  void prepared.then((workflow) => {
    if (!workflow) {
      stop()
      if (!tab.closed) tab.location.href = platformBuildImportUrl()
    }
  })
}

export function usePlatformBuildHandoff() {
  const workflowStore = useWorkflowStore()

  async function open(): Promise<boolean> {
    const workflow = workflowStore.activeWorkflow
    const bare = platformBuildImportUrl()
    if (isDesktop || !workflow) {
      if (workflow) await downloadWorkflowFile(workflow.fullFilename)
      window.open(bare, '_blank', 'noopener')
      return true
    }

    const nonce = createUuidv4()
    const tab = window.open(platformBuildImportUrl(nonce), '_blank')
    if (!tab) {
      const downloaded = await downloadWorkflowFile(workflow.fullFilename)
      useToast().error(
        t(
          downloaded
            ? 'deployToComfyApi.popupBlockedDownloadStarted'
            : 'deployToComfyApi.popupBlocked'
        ),
        { description: bare, duration: 8000 }
      )
      return false
    }

    armHandoff(tab, nonce, workflow.fullFilename)
    return true
  }

  return { open }
}
