import { z } from 'zod'

import { downloadBlob } from '@/base/common/downloadUtil'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { CloudWorkflowPage } from '@/platform/workflow/cloud/cloudWorkflowPages'
import {
  cloudWorkflowPageRoute,
  nextCloudWorkflowPage,
  zCloudWorkflowPage
} from '@/platform/workflow/cloud/cloudWorkflowPages'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { cloudWorkflowName } from '@/platform/workflow/management/utils/cloudWorkflowName'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'

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

/** The part of an opened tab the handoff talks to. */
export interface PlatformTab {
  readonly closed: boolean
  isSourceOf(event: MessageEvent): boolean
  postMessage(message: unknown, targetOrigin: string): void
  navigate(url: string): void
}

export interface PlatformTabOpener {
  /** A tab that keeps its opener, or undefined when a popup blocker refused it. */
  open(url: string): PlatformTab | undefined
  /** Desktop hands this to the system browser; nothing can be learned back. */
  openDisowned(url: string): void
}

const browserTabs: PlatformTabOpener = {
  open(url) {
    const tab = window.open(url, '_blank')
    if (!tab) return undefined
    return {
      get closed() {
        return tab.closed
      },
      isSourceOf: (event) => event.source === tab,
      postMessage: (message, targetOrigin) =>
        tab.postMessage(message, targetOrigin),
      navigate: (target) => {
        tab.location.href = target
      }
    }
  },
  openDisowned(url) {
    window.open(url, '_blank', 'noopener')
  }
}

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

async function readCloudWorkflowPage(
  name: string,
  after: string | undefined
): Promise<CloudWorkflowPage | undefined> {
  const response = await api.fetchApi(cloudWorkflowPageRoute({ name, after }))
  if (!response.ok) return undefined
  const page = zCloudWorkflowPage.safeParse(
    await response.json().catch(() => undefined)
  )
  return page.success ? page.data : undefined
}

/**
 * The server's name filter is a partial match. Every reachable page, up to
 * the cap, is read while exact matches are collected, because finding one is
 * not proof it is the only one. A name shared by two workflows, a page that
 * says more exist without a way to reach them, or a walk cut short at the
 * cap all count as no match: the wizard could otherwise preselect the wrong
 * workflow.
 */
export async function findCloudWorkflowId(
  name: string
): Promise<string | undefined> {
  const matches: string[] = []
  const seen = new Set<string>()
  let after: string | undefined
  for (let pages = 0; pages < MAX_LOOKUP_PAGES; pages++) {
    const page = await readCloudWorkflowPage(name, after)
    if (!page) return undefined
    for (const entry of page.data)
      if (entry.name === name) matches.push(entry.id)
    if (matches.length > 1) return undefined
    const next = nextCloudWorkflowPage(page, seen)
    if (next.kind === 'done') return matches[0]
    if (next.kind === 'broken') return undefined
    after = next.cursor
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
 * armed as the tab opens, before the workflow is prepared, and sends as soon
 * as both have arrived. It outlives the deploy dialog on purpose, and ends
 * when the workflow is sent, the tab closes, or 60 seconds pass (the wizard
 * asks for 30). A workflow that cannot be prepared sends the tab to the
 * plain import step.
 */
function armHandoff(
  tab: PlatformTab,
  nonce: string,
  filename: string,
  prepared: Promise<ComfyWorkflowJSON | undefined>
): void {
  const platformOrigin = new URL(getComfyPlatformBaseUrl()).origin
  let asked = false
  let workflow: ComfyWorkflowJSON | undefined
  function send() {
    if (asked && workflow)
      tab.postMessage(
        { type: HANDOFF_WORKFLOW, nonce, filename, workflow },
        platformOrigin
      )
  }
  function onMessage(event: MessageEvent) {
    if (!tab.isSourceOf(event) || event.origin !== platformOrigin) return
    const ready = zHandoffReady.safeParse(event.data)
    if (!ready.success || ready.data.nonce !== nonce) return
    stop()
    asked = true
    send()
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
  void prepared.then((json) => {
    if (!json) {
      stop()
      tab.navigate(platformBuildImportUrl({ kind: 'bare' }))
      return
    }
    workflow = json
    send()
  })
}

function reportHandoffError(error: unknown): void {
  reportError(error, {
    errorType: 'error_preparing_platform_build_handoff',
    surface: 'platform'
  })
}

export function usePlatformBuildHandoff({
  tabs = browserTabs,
  lookUpCloudId = findCloudWorkflowId
}: {
  tabs?: PlatformTabOpener
  lookUpCloudId?: (name: string) => Promise<string | undefined>
} = {}) {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const toastStore = useToastStore()

  let savedCloudCopy: { workflow: ComfyWorkflow; id: string } | undefined
  const lookedUp = workflowStore.activeWorkflow
  if (isCloud && lookedUp && !lookedUp.isTemporary && !lookedUp.isModified) {
    lookUpCloudId(cloudWorkflowName(lookedUp))
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

  /**
   * The workflow checked against the workflow schema, so what leaves the app
   * is a workflow the wizard can read, not only what the graph serialized.
   */
  async function prepareWorkflow(): Promise<ComfyWorkflowJSON | undefined> {
    try {
      return (
        (await validateComfyWorkflow(
          workflowService.prepareWorkflowJson(),
          (message) => reportHandoffError(new Error(message))
        )) ?? undefined
      )
    } catch (error) {
      reportHandoffError(error)
      return undefined
    }
  }

  /** Whether a download was started. There is no prompt, so nothing to cancel. */
  async function downloadWorkflowFile(
    workflow: ComfyWorkflow
  ): Promise<boolean> {
    const json = await prepareWorkflow()
    if (!json) return false
    try {
      downloadBlob(
        `${cloudWorkflowName(workflow)}.json`,
        new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      )
      return true
    } catch (error) {
      reportHandoffError(error)
      return false
    }
  }

  function tellBlocked(url: string, downloadStarted: boolean): false {
    toastStore.add({
      severity: 'error',
      summary: t(
        downloadStarted
          ? 'deployToComfyApi.popupBlockedDownloadStarted'
          : 'deployToComfyApi.popupBlocked'
      ),
      detail: url,
      life: 8000
    })
    return false
  }

  /**
   * Call from the click handler, and keep the call first: in a browser the
   * tab has to open inside the click's user activation, so nothing is awaited
   * before it. Resolves to whether a tab was opened. Desktop's system-browser
   * open cannot report back, so it counts as opened.
   */
  async function open(): Promise<boolean> {
    const workflow = workflowStore.activeWorkflow
    const bare = platformBuildImportUrl({ kind: 'bare' })

    if (isDesktop) {
      if (workflow) await downloadWorkflowFile(workflow)
      tabs.openDisowned(bare)
      return true
    }
    if (!workflow) return tabs.open(bare) ? true : tellBlocked(bare, false)

    const workflowId = cloudIdFor(workflow)
    if (workflowId) {
      const url = platformBuildImportUrl({ kind: 'cloud', workflowId })
      return tabs.open(url) ? true : tellBlocked(url, false)
    }

    const nonce = handoffNonce()
    const tab = tabs.open(platformBuildImportUrl({ kind: 'handoff', nonce }))
    if (!tab) return tellBlocked(bare, await downloadWorkflowFile(workflow))

    const prepared = prepareWorkflow()
    armHandoff(tab, nonce, `${cloudWorkflowName(workflow)}.json`, prepared)
    await prepared
    return true
  }

  return { open }
}
