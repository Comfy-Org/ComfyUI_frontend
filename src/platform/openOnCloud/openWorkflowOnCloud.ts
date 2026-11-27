import { isWorkspaceId } from '@comfyorg/account-core/workspaceLink'
import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { handsPopupsToSystemBrowser } from '@/platform/distribution/desktopBrowser'
import { bindLocalOpenOnCloudGrant } from '@/platform/openOnCloud/localOpenOnCloudRollout'
import {
  cloudEditorUrl,
  localHandoffWorkflow,
  trustedCloudHandoffOrigin,
  zLocalHandoffReady
} from '@/platform/openOnCloud/localHandoffProtocol'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { stageDesktopWorkflowHandoff } from '@/platform/openOnCloud/desktopWorkflowRelay'
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

  openDisowned(url: string): void
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
  },
  openDisowned(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
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

function downloadWorkflow(filename: string, workflow: ComfyWorkflowJSON) {
  downloadBlob(
    `${filename}.json`,
    new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' })
  )
}

function armHandoff(
  tab: CloudTab,
  nonce: string,
  origin: string,
  filename: string,
  prepared: Promise<ComfyWorkflowJSON | null>,
  revalidate: () => Promise<boolean>
): void {
  function onMessage(event: MessageEvent) {
    if (!tab.isSourceOf(event) || event.origin !== origin) return
    const ready = zLocalHandoffReady.safeParse(event.data)
    if (!ready.success || ready.data.nonce !== nonce) return
    stop()
    void prepared.then(async (workflow) => {
      if (workflow && (await revalidate()) && !tab.closed)
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

async function openFromDesktop(
  tabs: CloudTabOpener,
  filename: string,
  isAuthorized: () => boolean,
  revalidate: () => Promise<boolean>,
  workspaceId?: string
): Promise<void> {
  const workflow = await prepareWorkflow()
  if (!isAuthorized()) return
  if (!workflow) return showPrepareFailed()
  let checked: Promise<boolean> | undefined
  const authorize = () => (checked ??= revalidate())
  const relay = await stageDesktopWorkflowHandoff(
    filename,
    workflow,
    authorize,
    workspaceId
  ).catch(() => undefined)
  if (!(await authorize()) || !isAuthorized()) return
  if (relay) return tabs.openDisowned(relay)
  tabs.openDisowned(cloudEditorUrl(undefined, workspaceId))
  downloadWorkflow(filename, workflow)
  useToast().info(t('openOnCloud.downloaded'), {
    description: t('openOnCloud.downloadedDetail'),
    duration: NOTICE_MS
  })
}

export async function openWorkflowOnCloud(
  tabs: CloudTabOpener = browserTabs,
  workspaceId?: string
): Promise<void> {
  if (workspaceId !== undefined && !isWorkspaceId(workspaceId))
    return showPrepareFailed()
  const { flags } = useFeatureFlags()
  const origin = trustedCloudHandoffOrigin()
  if (!origin) return
  const grant = bindLocalOpenOnCloudGrant()
  const isAuthorized = () =>
    flags.openOnCloudEnabled &&
    grant.isCurrent() &&
    trustedCloudHandoffOrigin() === origin
  const revalidate = async () => {
    if (!isAuthorized()) return false
    const verified = await grant.revalidate()
    if (!verified && grant.isCurrent()) {
      useToast().error(t('openOnCloud.verifyAccessFailed'), {
        description: t('openOnCloud.verifyAccessFailedDetail'),
        duration: NOTICE_MS
      })
    }
    return verified && isAuthorized()
  }
  if (!isAuthorized()) return
  const filename = useWorkflowStore().activeWorkflow?.filename ?? 'workflow'
  if (handsPopupsToSystemBrowser())
    return openFromDesktop(
      tabs,
      filename,
      isAuthorized,
      revalidate,
      workspaceId
    )

  const nonce = handoffNonce()
  const tab = tabs.open(cloudEditorUrl(nonce, workspaceId))
  if (!tab) {
    useToast().error(t('openOnCloud.popupBlocked'), { duration: NOTICE_MS })
    return
  }
  const prepared = prepareWorkflow()
  armHandoff(tab, nonce, origin, filename, prepared, revalidate)
  if (!(await prepared)) showPrepareFailed()
}
