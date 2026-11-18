import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { handoffFileName } from '@/platform/workflow/deploy/utils/agentHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { platformSurfaceLink } from '@/platform/workspace/utils/platformLink'
import type { PlatformLinkSurface } from '@/platform/workspace/utils/platformLink'

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

/** A nonce Platform's build wizard accepts for one handoff. */
export function createHandoffNonce(): string {
  return crypto.randomUUID()
}

/** Platform's build wizard at its import step, asking its opener for the workflow under `nonce`. */
export function workflowHandoffUrl(
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
  open?.changeTracker.prepareForSave()
  if (!open?.activeState) return null
  const workflow: unknown = JSON.parse(JSON.stringify(open.activeState))
  return {
    filename: handoffFileName(open.filename.replace(/\.json$/i, '')),
    workflow
  }
}

/** Opens the wizard at `url` with this tab as its opener and hands it the open workflow; false when the browser blocked the tab. */
export function openPlatformWithWorkflow(url: string, nonce: string): boolean {
  const handed = captureOpenWorkflow()
  const wizard = window.open(url, '_blank')
  if (!wizard) return false
  if (handed) {
    answerWorkflowHandoff({
      ...handed,
      nonce,
      wizard,
      platformOrigin: new URL(getComfyPlatformBaseUrl()).origin
    })
  }
  return true
}
