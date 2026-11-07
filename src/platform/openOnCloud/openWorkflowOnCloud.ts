import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import {
  cloudEditorUrl,
  cloudOrigin,
  localHandoffWorkflow,
  zLocalHandoffReady
} from '@/platform/openOnCloud/localHandoffProtocol'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const NONCE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const TAB_CLOSED_POLL_MS = 1000
const HANDOFF_DEADLINE_MS = 10 * 60_000
const NOTICE_MS = 8000

export interface CloudTab {
  readonly closed: boolean
  isSourceOf(event: MessageEvent): boolean
  postMessage(message: unknown, targetOrigin: string): void
}

export interface CloudTabOpener {
  open(url: string): CloudTab | undefined
}

const browserTabs: CloudTabOpener = {
  open(url) {
    const tab = window.open(url, '_blank')
    if (!tab) return undefined
    return {
      get closed() {
        return tab.closed
      },
      isSourceOf: (event) => event.source === tab,
      postMessage: (message, targetOrigin) =>
        tab.postMessage(message, targetOrigin)
    }
  }
}

function handoffNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => NONCE_ALPHABET[byte % 64]).join('')
}

async function prepareWorkflow(): Promise<ComfyWorkflowJSON | null> {
  const graph = serializeRootGraph()
  return graph ? validateComfyWorkflow(graph) : null
}

function showPrepareFailed() {
  useToast().error(t('openOnCloud.prepareFailed'), {
    description: t('openOnCloud.prepareFailedDetail'),
    duration: NOTICE_MS
  })
}

function armHandoff(
  tab: CloudTab,
  nonce: string,
  filename: string,
  prepared: Promise<ComfyWorkflowJSON | null>
): void {
  const origin = cloudOrigin()
  function onMessage(event: MessageEvent) {
    if (!tab.isSourceOf(event) || event.origin !== origin) return
    const ready = zLocalHandoffReady.safeParse(event.data)
    if (!ready.success || ready.data.nonce !== nonce) return
    stop()
    void prepared.then((workflow) => {
      if (workflow)
        tab.postMessage(localHandoffWorkflow(nonce, filename, workflow), origin)
    })
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
  void prepared.then((workflow) => {
    if (!workflow) stop()
  })
}

export async function openWorkflowOnCloud(
  tabs: CloudTabOpener = browserTabs
): Promise<void> {
  const filename = useWorkflowStore().activeWorkflow?.filename ?? 'workflow'
  const nonce = handoffNonce()
  const tab = tabs.open(cloudEditorUrl(nonce))
  if (!tab) {
    useToast().error(t('openOnCloud.popupBlocked'), { duration: NOTICE_MS })
    return
  }
  const prepared = prepareWorkflow()
  armHandoff(tab, nonce, filename, prepared)
  if (!(await prepared)) showPrepareFailed()
}
