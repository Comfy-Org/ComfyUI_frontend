import { reportError } from '@comfyorg/telemetry/reportError'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { handsPopupsToSystemBrowser } from '@/platform/distribution/desktopBrowser'
import { handoffFileName } from '@/platform/workflow/deploy/utils/agentHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { platformSurfaceLink } from '@/platform/workspace/utils/platformLink'
import type { PlatformLinkSurface } from '@/platform/workspace/utils/platformLink'
import { createUuidv4 } from '@/utils/uuid'

const HANDOFF_READY = 'comfy-build-handoff:ready'
const HANDOFF_WORKFLOW = 'comfy-build-handoff:workflow'
const WIZARD_CLOSED_POLL_MS = 1000

interface HandedWorkflow {
  filename: string
  workflow: unknown
}

interface WorkflowHandoff extends HandedWorkflow {
  nonce: string
  wizard: Window
  platformOrigin: string
}

function workflowHandoffUrl(
  nonce: string,
  surface: PlatformLinkSurface
): string {
  return platformSurfaceLink(
    `/profile/builds/new?step=import&handoff=${encodeURIComponent(nonce)}`,
    surface
  )
}

function asksFor(data: unknown, nonce: string): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === HANDOFF_READY &&
    'nonce' in data &&
    data.nonce === nonce
  )
}

/** Answers every ready message `wizard` sends from Platform under the nonce, until it closes or the returned stop runs. */
export function answerWorkflowHandoff({
  nonce,
  wizard,
  platformOrigin,
  filename,
  workflow
}: WorkflowHandoff): () => void {
  function onMessage(event: MessageEvent) {
    if (event.source !== wizard) return
    if (event.origin !== platformOrigin) return
    if (!asksFor(event.data, nonce)) return
    wizard.postMessage(
      { type: HANDOFF_WORKFLOW, nonce, filename, workflow },
      platformOrigin
    )
  }
  function stop() {
    clearInterval(closedPoll)
    window.removeEventListener('message', onMessage)
  }
  const closedPoll = setInterval(() => {
    if (wizard.closed) stop()
  }, WIZARD_CLOSED_POLL_MS)
  window.addEventListener('message', onMessage)
  return stop
}

function captureOpenWorkflow(): HandedWorkflow | null {
  const open = useWorkflowStore().activeWorkflow
  try {
    open?.changeTracker.prepareForSave()
    if (!open?.activeState) return null
    const workflow: unknown = JSON.parse(JSON.stringify(open.activeState))
    return {
      filename: handoffFileName(open.filename.replace(/\.json$/i, '')),
      workflow
    }
  } catch (error) {
    reportError(error, {
      errorType: 'error_capturing_workflow_for_platform',
      surface: 'platform'
    })
    return null
  }
}

/** Opens Platform's build wizard with this tab as its opener and hands it the open workflow; false when it opened nothing, so the caller's plain link must do the opening. */
export function openPlatformWithWorkflow(
  surface: PlatformLinkSurface
): boolean {
  if (__DISTRIBUTION__ !== 'cloud' || handsPopupsToSystemBrowser()) return false
  const handed = captureOpenWorkflow()
  if (!handed) return false
  const nonce = createUuidv4()
  const wizard = window.open(workflowHandoffUrl(nonce, surface), '_blank')
  if (!wizard || wizard.closed) return false
  answerWorkflowHandoff({
    ...handed,
    nonce,
    wizard,
    platformOrigin: new URL(getComfyPlatformBaseUrl()).origin
  })
  return true
}

function asksForItsOwnTab(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

/** For a click on a Platform link: opens the build wizard with the open workflow in the link's place, or leaves the click to the link. */
export function handOverWorkflowOnClick(
  event: MouseEvent,
  surface: PlatformLinkSurface
): void {
  if (asksForItsOwnTab(event)) return
  if (openPlatformWithWorkflow(surface)) event.preventDefault()
}
