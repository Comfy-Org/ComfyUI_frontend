import { z } from 'zod'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

const zCloudWorkflowList = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string().optional() }))
})

const HANDOFF_READY = 'comfy-build-handoff:ready'
const HANDOFF_WORKFLOW = 'comfy-build-handoff:workflow'
const zHandoffReady = z.object({
  type: z.literal(HANDOFF_READY),
  nonce: z.string()
})

const NONCE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const TAB_CLOSED_POLL_MS = 1000

type PlatformBuildArrival =
  | { kind: 'cloud'; workflowId: string }
  | { kind: 'handoff'; nonce: string }
  | { kind: 'bare' }

function platformBuildImportUrl(arrival: PlatformBuildArrival): string {
  const url = new URL('/profile/builds/new', getComfyPlatformBaseUrl())
  url.searchParams.set('step', 'import')
  if (arrival.kind === 'cloud')
    url.searchParams.set('workflow', arrival.workflowId)
  if (arrival.kind === 'handoff') url.searchParams.set('handoff', arrival.nonce)
  return url.href
}

/** The name Cloud gives a workflow saved as `workflows/<name>.json`. */
function cloudWorkflowName(workflow: ComfyWorkflow): string {
  return workflow.path.replace(/^workflows\//, '').replace(/\.json$/i, '')
}

async function findCloudWorkflowId(name: string): Promise<string | undefined> {
  const response = await api.fetchApi(
    `/workflows?name=${encodeURIComponent(name)}&limit=50`
  )
  if (!response.ok) return undefined
  const parsed = zCloudWorkflowList.safeParse(await response.json())
  if (!parsed.success) return undefined
  return parsed.data.data.find((entry) => entry.name === name)?.id
}

function handoffNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => NONCE_ALPHABET[byte % 64]).join('')
}

/**
 * Answers the wizard's ready message with the workflow, once. The nonce ties
 * the reply to this click and the reply goes to the origin the ready message
 * came from, never to `*`. The listener outlives the deploy dialog on purpose:
 * the dialog closes as soon as the tab is on its way, before the wizard has
 * mounted, so it ends when the workflow is sent or the tab closes instead.
 */
function armHandoff(
  tab: Window,
  nonce: string,
  filename: string,
  workflow: ComfyWorkflowJSON
): void {
  function onMessage(event: MessageEvent) {
    if (event.source !== tab) return
    const ready = zHandoffReady.safeParse(event.data)
    if (!ready.success || ready.data.nonce !== nonce) return
    stop()
    tab.postMessage(
      { type: HANDOFF_WORKFLOW, nonce, filename, workflow },
      event.origin
    )
  }
  function stop() {
    window.removeEventListener('message', onMessage)
    clearInterval(closedPoll)
  }
  const closedPoll = setInterval(() => {
    if (tab.closed) stop()
  }, TAB_CLOSED_POLL_MS)
  window.addEventListener('message', onMessage)
}

function showOpeningNotice(tab: Window): void {
  tab.document.write(
    `<!doctype html><title>${t('deployToComfyApi.openingBuildWizard')}</title>` +
      `<p style="font-family:system-ui,sans-serif;padding:2rem">` +
      `${t('deployToComfyApi.openingBuildWizard')}</p>`
  )
}

/**
 * Opens the platform's build wizard on its import step with the open
 * workflow already picked. On Cloud the saved workflow is in the workspace
 * library the wizard reads, so its id goes in the link. Otherwise the tab we
 * opened is the channel: the link carries a nonce and the workflow JSON is
 * posted to the wizard when it says it is ready. Without a tab of our own
 * (Desktop hands new windows to the system browser, or the popup was
 * blocked) the workflow file is exported for the wizard's drop zone instead.
 */
export function usePlatformBuildHandoff() {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()

  async function findSavedCloudWorkflowId(
    workflow: ComfyWorkflow
  ): Promise<string | undefined> {
    const needsSave = workflow.isTemporary || workflow.isModified
    if (needsSave && !(await workflowService.saveWorkflow(workflow))) {
      return undefined
    }
    return findCloudWorkflowId(cloudWorkflowName(workflow))
  }

  async function resolveUrl(tab: Window | null): Promise<string> {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return platformBuildImportUrl({ kind: 'bare' })
    const name = cloudWorkflowName(workflow)

    const workflowId = isCloud
      ? await findSavedCloudWorkflowId(workflow)
      : undefined
    if (workflowId) return platformBuildImportUrl({ kind: 'cloud', workflowId })

    if (!tab) {
      await workflowService.exportWorkflow(name, 'workflow')
      return platformBuildImportUrl({ kind: 'bare' })
    }

    const nonce = handoffNonce()
    const { workflow: graph } = await app.graphToPrompt()
    armHandoff(tab, nonce, `${name}.json`, graph)
    return platformBuildImportUrl({ kind: 'handoff', nonce })
  }

  /**
   * Call from the click handler: in a browser the tab opens on the gesture
   * itself, then lands where the workflow is once the save and lookup have
   * finished. Desktop hands every new window to the system browser, so it
   * gets the resolved link in one go.
   */
  async function open(): Promise<void> {
    const tab = isDesktop ? null : window.open('', '_blank')
    if (tab) showOpeningNotice(tab)
    const url = await resolveUrl(tab)
    if (tab) tab.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  return { open }
}
