import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { isEqual } from 'es-toolkit'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { fetchSavedWorkflow } from '@/services/savedWorkflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { readSavedWorkflowLink } from '@/platform/navigation/savedWorkflowLink'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type SavedWorkflowUrlLoadStatus =
  | 'not-present'
  | 'deferred'
  | 'loaded'
  | 'failed'

type ValidSavedWorkflowLink = Extract<
  ReturnType<typeof readSavedWorkflowLink>,
  { status: 'valid' }
>

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKFLOW

export function useSavedWorkflowUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toast = useToast()
  const { isLoggedIn, resolvedUserInfo } = useCurrentUser()
  const workspaceStore = useTeamWorkspaceStore()
  const deploymentStore = useDeploymentPickStore()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  let pending: Promise<SavedWorkflowUrlLoadStatus> | null = null
  let pendingController: AbortController | null = null
  let disposed = false
  let retryWhenReady = false
  tryOnScopeDispose(() => {
    disposed = true
    retryWhenReady = false
    pendingController?.abort()
  })

  function linkQuery() {
    hydratePreservedQuery(NAMESPACE)
    return mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
  }

  async function clearIntent(expected?: ValidSavedWorkflowLink) {
    if (expected && !isEqual(readSavedWorkflowLink(linkQuery()), expected))
      return
    clearPreservedQuery(NAMESPACE)
    if (!('workflow' in route.query)) return
    const query = { ...route.query }
    delete query.workflow
    try {
      await router.replace({ query })
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'error_clearing_saved_workflow_link'
      })
    }
  }

  function readyContext() {
    if (!isLoggedIn.value || workspaceStore.initState !== 'ready') return null
    const userId = resolvedUserInfo.value?.id
    const workspaceId = workspaceStore.activeWorkspace?.id
    if (!userId || !workspaceId) return null
    return { userId, workspaceId }
  }

  function hasSameIdentity(context: { userId: string; workspaceId: string }) {
    return (
      isLoggedIn.value &&
      resolvedUserInfo.value?.id === context.userId &&
      workspaceStore.activeWorkspace?.id === context.workspaceId
    )
  }

  function hasSameBootEnvironment(bootDeploymentId: string | null) {
    return (
      (deploymentStore.bootDeployment?.deployment_id ?? null) ===
        bootDeploymentId &&
      !deploymentStore.isSwitching &&
      !deploymentStore.changeSinceBoot
    )
  }

  function matchesTarget(link: ValidSavedWorkflowLink, workspaceId: string) {
    if (link.workspaceId && link.workspaceId !== workspaceId) return false
    if (link.deploymentId)
      return link.deploymentId === deploymentStore.bootDeployment?.deployment_id
    return !link.environment || deploymentStore.bootDeployment === null
  }

  function canReplayDeploymentChange(link: ValidSavedWorkflowLink) {
    return (
      link.deploymentId === null &&
      link.environment === null &&
      deploymentStore.changeSinceBoot === 'deployment' &&
      !deploymentStore.isSwitching
    )
  }

  async function openSavedDocument(
    path: string,
    isCurrent: () => boolean
  ): Promise<SavedWorkflowUrlLoadStatus> {
    if (!isCurrent()) return 'failed'
    await workflowStore.loadWorkflows()
    if (!isCurrent()) return 'failed'
    const workflow = workflowStore.getWorkflowByPath(path)
    if (!workflow || !workflow.isPersisted) {
      toast.error(t('workflowService.privateLinkFileUnavailable'))
      return 'failed'
    }
    if (!(await workflowService.openWorkflow(workflow, { isCurrent }))) {
      toast.error(t('workflowService.privateLinkUnavailable'))
      return 'failed'
    }
    return 'loaded'
  }

  async function readAndOpen(
    workflowId: string,
    controller: AbortController,
    isCurrent: () => boolean
  ): Promise<SavedWorkflowUrlLoadStatus> {
    const saved = await fetchSavedWorkflow(workflowId, controller.signal)
    if (saved.ok) return openSavedDocument(saved.path, isCurrent)
    if (saved.reason === 'cancelled') return 'failed'
    const message = {
      unavailable: 'workflowService.privateLinkUnavailable',
      file_unavailable: 'workflowService.privateLinkFileUnavailable',
      file_mismatch: 'workflowService.privateLinkFileMismatch'
    } as const
    toast.error(t(message[saved.reason]))
    return 'failed'
  }

  async function load(): Promise<SavedWorkflowUrlLoadStatus> {
    const link = readSavedWorkflowLink(linkQuery())
    if (link.status === 'absent') return 'not-present'
    if (link.status === 'invalid') {
      toast.error(t('workflowService.privateLinkInvalid'))
      await clearIntent()
      return 'failed'
    }
    const context = readyContext()
    if (!context) return 'deferred'
    const bootDeploymentId =
      deploymentStore.bootDeployment?.deployment_id ?? null
    const controller = new AbortController()
    const isCurrent = () => {
      const current = readSavedWorkflowLink(linkQuery())
      return (
        !disposed &&
        !controller.signal.aborted &&
        hasSameIdentity(context) &&
        matchesTarget(link, context.workspaceId) &&
        hasSameBootEnvironment(bootDeploymentId) &&
        isEqual(current, link)
      )
    }
    const preserveForDeploymentReload = () => {
      return (
        !disposed &&
        !controller.signal.aborted &&
        hasSameIdentity(context) &&
        matchesTarget(link, context.workspaceId) &&
        isEqual(readSavedWorkflowLink(linkQuery()), link) &&
        canReplayDeploymentChange(link)
      )
    }
    pendingController = controller
    const stopContextWatcher = watch(
      [
        isLoggedIn,
        () => resolvedUserInfo.value?.id,
        () => workspaceStore.activeWorkspace?.id,
        () => deploymentStore.bootDeployment?.deployment_id,
        () => deploymentStore.isSwitching
      ],
      () => controller.abort(),
      { flush: 'sync' }
    )
    try {
      if (!isCurrent()) {
        toast.error(t('workflowService.privateLinkTargetMismatch'))
        return 'failed'
      }
      return await readAndOpen(link.workflowId, controller, isCurrent)
    } catch (error) {
      toast.error(t('workflowService.privateLinkUnavailable'))
      reportError(error, {
        surface: 'graph',
        errorType: 'error_loading_saved_workflow_link'
      })
      return 'failed'
    } finally {
      stopContextWatcher()
      pendingController = null
      if (!preserveForDeploymentReload()) await clearIntent(link)
    }
  }

  function openSavedWorkflowFromUrl(): Promise<SavedWorkflowUrlLoadStatus> {
    if (disposed) return Promise.resolve('failed')
    pending ??= load()
      .then((status) => {
        retryWhenReady = status === 'deferred'
        return status
      })
      .finally(() => {
        pending = null
        resumeDeferred()
      })
    return pending
  }

  function resumeDeferred() {
    if (!retryWhenReady || pending || disposed || !readyContext()) return
    retryWhenReady = false
    void openSavedWorkflowFromUrl().catch((error) => {
      toast.error(t('workflowService.privateLinkUnavailable'))
      reportError(error, {
        surface: 'graph',
        errorType: 'error_loading_saved_workflow_link'
      })
    })
  }
  watch(readyContext, resumeDeferred, { flush: 'post' })
  return { openSavedWorkflowFromUrl }
}
import { tryOnScopeDispose } from '@vueuse/core'
import { watch } from 'vue'
