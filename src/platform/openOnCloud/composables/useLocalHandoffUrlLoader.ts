import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import {
  LOCAL_HANDOFF_PARAM,
  isLocalOrigin,
  localHandoffReady,
  zLocalHandoffWorkflow
} from '@/platform/openOnCloud/localHandoffProtocol'
import { reportError } from '@comfyorg/telemetry/reportError'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { app } from '@/scripts/app'
import { takeDesktopWorkflowHandoff } from '@/platform/openOnCloud/desktopWorkflowHandoff'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.LOCAL_HANDOFF
const HANDOFF_WAIT_MS = 60_000
const NOTICE_MS = 8000

function showMissingWorkflow() {
  useToast().error(t('openOnCloud.handoffMissing'), {
    description: t('openOnCloud.handoffMissingDetail'),
    duration: NOTICE_MS
  })
}

async function openHandedOffWorkflow(
  filename: string,
  data: unknown
): Promise<void> {
  const toast = useToast()
  const workflow = await validateComfyWorkflow(data)
  if (!workflow) {
    toast.error(t('openOnCloud.handoffFailed'), { duration: NOTICE_MS })
    return
  }
  try {
    const outcome = await app.loadGraphData(workflow, true, true, filename)
    if (outcome === false || outcome === undefined) return
  } catch (error) {
    reportError(error, {
      errorType: 'failure_loading_open_on_cloud_workflow',
      surface: 'graph'
    })
    toast.error(t('openOnCloud.handoffFailed'), { duration: NOTICE_MS })
    return
  }
  toast.info(t('openOnCloud.openedFromLocal'), {
    description: t('openOnCloud.openedFromLocalDetail'),
    duration: NOTICE_MS
  })
}

function requestWorkflow(opener: Window, nonce: string): void {
  function onMessage(event: MessageEvent) {
    if (event.source !== opener || !isLocalOrigin(event.origin)) return
    const handoff = zLocalHandoffWorkflow.safeParse(event.data)
    if (!handoff.success || handoff.data.nonce !== nonce) return
    stop()
    void openHandedOffWorkflow(handoff.data.filename, handoff.data.workflow)
  }
  function stop() {
    window.removeEventListener('message', onMessage)
    clearTimeout(deadline)
  }
  const deadline = setTimeout(() => {
    stop()
    showMissingWorkflow()
  }, HANDOFF_WAIT_MS)
  window.addEventListener('message', onMessage)
  opener.postMessage(localHandoffReady(nonce), '*')
}

export function useLocalHandoffUrlLoader(
  getOpener: () => Window | null = () => window.opener
) {
  const route = useRoute()
  const router = useRouter()
  const { flags } = useFeatureFlags()

  async function receiveHandoff(nonce: string) {
    // Taken even when the flag is off, so a stale Desktop handoff is cleared.
    const desktop = takeDesktopWorkflowHandoff(nonce)
    if (!flags.openOnCloudEnabled) return
    if (desktop)
      return openHandedOffWorkflow(desktop.filename, desktop.workflow)
    const opener = getOpener()
    if (opener) requestWorkflow(opener, nonce)
    else showMissingWorkflow()
  }

  async function loadLocalHandoffFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const nonce = query[LOCAL_HANDOFF_PARAM]
    if (nonce === undefined) return

    const cleanQuery = { ...query }
    delete cleanQuery[LOCAL_HANDOFF_PARAM]
    const stripped = router.replace({ query: cleanQuery }).catch((error) => {
      console.warn(
        '[useLocalHandoffUrlLoader] Failed to clean URL params:',
        error
      )
    })
    clearPreservedQuery(NAMESPACE)

    if (typeof nonce === 'string') await receiveHandoff(nonce)
    await stripped
  }

  return { loadLocalHandoffFromUrl }
}
