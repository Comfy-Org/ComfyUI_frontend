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

function showOpeningNotice(tab: Window): void {
  tab.document.write(
    `<!doctype html><title>${t('deployToComfyApi.openingBuildWizard')}</title>` +
      `<p style="font-family:system-ui,sans-serif;padding:2rem">` +
      `${t('deployToComfyApi.openingBuildWizard')}</p>`
  )
}

function reportHandoffError(error: unknown): void {
  reportError(error, { errorType: 'error_preparing_platform_build_handoff' })
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
  const toastStore = useToastStore()

  async function savedCloudWorkflowId(
    workflow: ComfyWorkflow
  ): Promise<string | undefined> {
    if (workflow.isTemporary) return undefined
    if (workflow.isModified && !(await workflowService.saveWorkflow(workflow)))
      return undefined
    try {
      return await findCloudWorkflowId(cloudWorkflowName(workflow))
    } catch (error) {
      reportHandoffError(error)
      return undefined
    }
  }

  async function resolveUrl(tab: Window | null): Promise<string> {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return platformBuildImportUrl({ kind: 'bare' })

    const workflowId = isCloud
      ? await savedCloudWorkflowId(workflow)
      : undefined
    if (workflowId) return platformBuildImportUrl({ kind: 'cloud', workflowId })

    if (!tab) {
      await workflowService.exportWorkflow(workflow.filename, 'workflow')
      return platformBuildImportUrl({ kind: 'bare' })
    }

    const nonce = handoffNonce()
    const { workflow: graph } = await app.graphToPrompt()
    armHandoff(tab, nonce, `${cloudWorkflowName(workflow)}.json`, graph)
    return platformBuildImportUrl({ kind: 'handoff', nonce })
  }

  /**
   * Call from the click handler. A temporary workflow is saved first, because
   * its save prompt has to be answered on this tab. Then in a browser the tab
   * opens on the gesture and lands where the workflow is once the lookup has
   * finished. Desktop hands every new window to the system browser, so it gets
   * the resolved link in one go. Resolves to whether a tab was opened.
   */
  async function open(): Promise<boolean> {
    const workflow = workflowStore.activeWorkflow
    if (isCloud && workflow?.isTemporary)
      await workflowService.saveWorkflow(workflow).catch(reportHandoffError)

    const tab = isDesktop ? null : window.open('', '_blank')
    if (tab) showOpeningNotice(tab)
    const url = await resolveUrl(tab).catch((error: unknown) => {
      reportHandoffError(error)
      return platformBuildImportUrl({ kind: 'bare' })
    })
    if (tab) {
      tab.location.href = url
      return true
    }
    if (isDesktop) {
      window.open(url, '_blank', 'noopener')
      return true
    }
    if (window.open(url, '_blank')) return true
    toastStore.add({
      severity: 'error',
      summary: t('deployToComfyApi.popupBlocked'),
      detail: url,
      life: 8000
    })
    return false
  }

  return { open }
}
