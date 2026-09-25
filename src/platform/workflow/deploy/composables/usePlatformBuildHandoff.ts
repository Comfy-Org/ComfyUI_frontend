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
const HANDOFF_DEADLINE_MS = 60_000
const MAX_LOOKUP_PAGES = 20

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

/** One page of Cloud workflows whose name matches exactly, and the next cursor. */
async function fetchExactMatches(
  name: string,
  cursor: string | undefined
): Promise<{ ids: string[]; next?: string } | undefined> {
  const after = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
  const response = await api.fetchApi(
    `/workflows?name=${encodeURIComponent(name)}&limit=${CLOUD_WORKFLOW_PAGE_SIZE}${after}`
  )
  if (!response.ok) return undefined
  const page = zCloudWorkflowPage.safeParse(await response.json())
  if (!page.success) return undefined
  const { data, pagination } = page.data
  return {
    ids: data.filter((entry) => entry.name === name).map((entry) => entry.id),
    next: pagination.has_more ? pagination.next_cursor : undefined
  }
}

/**
 * The id of the one Cloud workflow with exactly this name. The server's name
 * filter is a partial match, so pages are read until the exact match is found.
 * A name shared by two workflows, a cursor seen before, or a walk cut short at
 * the page cap all count as no match: the wizard could otherwise preselect
 * the wrong workflow.
 */
async function findCloudWorkflowId(name: string): Promise<string | undefined> {
  const matches: string[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  for (let pages = 0; pages < MAX_LOOKUP_PAGES; pages++) {
    const page = await fetchExactMatches(name, cursor)
    if (!page) return undefined
    matches.push(...page.ids)
    if (matches.length > 1) return undefined
    if (!page.next) return matches[0]
    if (seen.has(page.next)) return undefined
    seen.add(page.next)
    cursor = page.next
  }
  return undefined
}

function handoffNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => NONCE_ALPHABET[byte % 64]).join('')
}

/**
 * Answers the wizard's ready message with the workflow, once. Only a message
 * from the tab we opened, from the platform's origin, carrying this click's
 * nonce counts, and the reply goes to that origin alone. The listener is
 * armed as soon as the tab opens, before the graph is serialized, so an early
 * ready message is not missed. It outlives the deploy dialog on purpose, and
 * ends when the workflow is sent, the tab closes, or the wizard has had long
 * enough to ask. If the graph cannot be serialized the tab is sent to the
 * plain import step instead of waiting on a reply that will never come.
 */
function armHandoff(
  tab: Window,
  nonce: string,
  filename: string,
  graph: Promise<ComfyWorkflowJSON>
): void {
  const platformOrigin = new URL(getComfyPlatformBaseUrl()).origin
  function onMessage(event: MessageEvent) {
    if (event.source !== tab || event.origin !== platformOrigin) return
    const ready = zHandoffReady.safeParse(event.data)
    if (!ready.success || ready.data.nonce !== nonce) return
    stop()
    void graph.then(
      (workflow) =>
        tab.postMessage(
          { type: HANDOFF_WORKFLOW, nonce, filename, workflow },
          platformOrigin
        ),
      () => undefined
    )
  }
  function stop() {
    window.removeEventListener('message', onMessage)
    clearInterval(closedPoll)
    clearTimeout(deadline)
  }
  const closedPoll = setInterval(() => {
    if (tab.closed) stop()
  }, TAB_CLOSED_POLL_MS)
  const deadline = setTimeout(stop, HANDOFF_DEADLINE_MS)
  window.addEventListener('message', onMessage)
  graph.catch((error: unknown) => {
    reportHandoffError(error)
    stop()
    tab.location.href = platformBuildImportUrl({ kind: 'bare' })
  })
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
        await workflowService
          .exportWorkflow(workflow.filename, 'workflow')
          .catch(reportHandoffError)
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
    armHandoff(
      tab,
      nonce,
      `${cloudWorkflowName(workflow)}.json`,
      app.graphToPrompt().then(({ workflow: graph }) => graph)
    )
    return true
  }

  return { open }
}
