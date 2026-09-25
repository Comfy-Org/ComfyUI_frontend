import { zWorkflowListResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { cloudWorkflowName } from '@/platform/workflow/management/utils/cloudWorkflowName'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

const zCloudWorkflowPage = zWorkflowListResponse
  .pick({ pagination: true })
  .extend({
    data: z.array(z.object({ id: z.string(), name: z.string().optional() }))
  })
const CLOUD_WORKFLOW_PAGE_SIZE = 100

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

/**
 * The id of the one Cloud workflow with exactly this name. The server's name
 * filter is a partial match, so pages are read until the exact match is found;
 * a name shared by two workflows is treated as no match, because the wizard
 * could otherwise preselect the wrong one.
 */
async function findCloudWorkflowId(name: string): Promise<string | undefined> {
  const matches: string[] = []
  let cursor: string | undefined
  do {
    const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
    const response = await api.fetchApi(
      `/workflows?name=${encodeURIComponent(name)}&limit=${CLOUD_WORKFLOW_PAGE_SIZE}${after}`
    )
    if (!response.ok) return undefined
    const page = zCloudWorkflowPage.safeParse(await response.json())
    if (!page.success) return undefined
    for (const entry of page.data.data)
      if (entry.name === name) matches.push(entry.id)
    const next = page.data.pagination.has_more
      ? page.data.pagination.next_cursor
      : undefined
    cursor = next === cursor ? undefined : next
  } while (cursor && matches.length < 2)
  return matches.length === 1 ? matches[0] : undefined
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

function reportHandoffError(error: unknown): void {
  reportError(error, { errorType: 'error_preparing_platform_build_handoff' })
}

/**
 * Opens the platform's build wizard on its import step with the open
 * workflow already picked, straight from the click: nothing is awaited before
 * the tab opens, so popup blockers see the gesture and no blank tab is needed.
 *
 * On Cloud a saved, unchanged workflow is already in the workspace library the
 * wizard reads, so its id is looked up as soon as the card opens and goes in
 * the link. Anything else in a browser goes over the tab we open: the link
 * carries a nonce and the workflow JSON is posted when the wizard says it is
 * ready. Desktop hands new windows to the system browser, so there is no tab
 * to talk to; the workflow file is exported for the wizard's drop zone.
 */
export function usePlatformBuildHandoff() {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const toastStore = useToastStore()

  let savedCloudCopy: { workflow: ComfyWorkflow; id: string } | undefined
  const lookedUp = workflowStore.activeWorkflow
  if (isCloud && lookedUp && !lookedUp.isTemporary && !lookedUp.isModified) {
    findCloudWorkflowId(cloudWorkflowName(lookedUp))
      .then((id) => {
        if (id) savedCloudCopy = { workflow: lookedUp, id }
      })
      .catch(reportHandoffError)
  }

  function cloudIdFor(workflow: ComfyWorkflow): string | undefined {
    if (savedCloudCopy?.workflow !== workflow) return undefined
    if (workflow.isTemporary || workflow.isModified) return undefined
    return savedCloudCopy.id
  }

  function tellBlocked(url: string): false {
    toastStore.add({
      severity: 'error',
      summary: t('deployToComfyApi.popupBlocked'),
      detail: url,
      life: 8000
    })
    return false
  }

  /**
   * Call from the click handler, and keep the call first: the tab has to open
   * inside the click's user activation. Resolves to whether a tab was opened.
   */
  async function open(): Promise<boolean> {
    const workflow = workflowStore.activeWorkflow
    const bare = platformBuildImportUrl({ kind: 'bare' })

    if (isDesktop) {
      if (workflow)
        await workflowService.exportWorkflow(workflow.filename, 'workflow')
      window.open(bare, '_blank', 'noopener')
      return true
    }
    if (!workflow) return window.open(bare, '_blank') ? true : tellBlocked(bare)

    const workflowId = cloudIdFor(workflow)
    if (workflowId) {
      const url = platformBuildImportUrl({ kind: 'cloud', workflowId })
      return window.open(url, '_blank') ? true : tellBlocked(url)
    }

    const nonce = handoffNonce()
    const tab = window.open(
      platformBuildImportUrl({ kind: 'handoff', nonce }),
      '_blank'
    )
    if (!tab) {
      await workflowService
        .exportWorkflow(workflow.filename, 'workflow')
        .catch(reportHandoffError)
      return tellBlocked(bare)
    }
    const { workflow: graph } = await app
      .graphToPrompt()
      .catch((error: unknown) => {
        reportHandoffError(error)
        return { workflow: undefined }
      })
    if (graph)
      armHandoff(tab, nonce, `${cloudWorkflowName(workflow)}.json`, graph)
    return true
  }

  return { open }
}
