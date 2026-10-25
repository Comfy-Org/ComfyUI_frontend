import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

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
import { fetchSavedWorkflow } from '@/platform/workflow/management/services/savedWorkflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { readSavedWorkflowLink } from '@/platform/workflow/management/utils/savedWorkflowLink'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type SavedWorkflowUrlLoadStatus =
  | 'not-present'
  | 'deferred'
  | 'loaded'
  | 'failed'

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
  tryOnScopeDispose(() => pendingController?.abort())

  function linkQuery() {
    hydratePreservedQuery(NAMESPACE)
    return mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
  }

  async function clearIntent(workflowId?: string) {
    if (workflowId) {
      const current = readSavedWorkflowLink(linkQuery())
      if (current.status !== 'valid' || current.workflowId !== workflowId)
        return
    }
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

  async function load(): Promise<SavedWorkflowUrlLoadStatus> {
    const link = readSavedWorkflowLink(linkQuery())
    if (link.status === 'absent') return 'not-present'
    if (link.status === 'invalid') {
      toast.error(t('workflowService.privateLinkInvalid'))
      await clearIntent()
      return 'failed'
    }
    const userId = resolvedUserInfo.value?.id
    const workspaceId = workspaceStore.activeWorkspace?.id
    if (
      !isLoggedIn.value ||
      !userId ||
      !workspaceId ||
      workspaceStore.initState !== 'ready'
    )
      return 'deferred'
    const bootDeploymentId =
      deploymentStore.bootDeployment?.deployment_id ?? null
    const {
      workflowId,
      workspaceId: targetWorkspaceId,
      deploymentId: targetDeploymentId,
      environment
    } = link
    const controller = new AbortController()
    function isCurrent() {
      const current = readSavedWorkflowLink(linkQuery())
      return (
        !controller.signal.aborted &&
        isLoggedIn.value &&
        resolvedUserInfo.value?.id === userId &&
        workspaceStore.activeWorkspace?.id === workspaceId &&
        (!targetWorkspaceId || targetWorkspaceId === workspaceId) &&
        (!targetDeploymentId ||
          targetDeploymentId ===
            deploymentStore.bootDeployment?.deployment_id) &&
        (!environment || deploymentStore.bootDeployment === null) &&
        (deploymentStore.bootDeployment?.deployment_id ?? null) ===
          bootDeploymentId &&
        !deploymentStore.isSwitching &&
        !deploymentStore.changeSinceBoot &&
        current.status === 'valid' &&
        current.workflowId === workflowId
      )
    }
    if (!isCurrent()) {
      toast.error(t('workflowService.privateLinkTargetMismatch'))
      await clearIntent(link.workflowId)
      return 'failed'
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
      const saved = await fetchSavedWorkflow(link.workflowId, controller.signal)
      if (!saved.ok) {
        if (saved.reason === 'cancelled') return 'failed'
        const message = {
          unavailable: 'workflowService.privateLinkUnavailable',
          file_unavailable: 'workflowService.privateLinkFileUnavailable',
          file_mismatch: 'workflowService.privateLinkFileMismatch'
        } as const
        toast.error(t(message[saved.reason]))
        return 'failed'
      }
      if (!isCurrent()) return 'failed'
      await workflowStore.loadWorkflows()
      if (!isCurrent()) return 'failed'
      const workflow = workflowStore.getWorkflowByPath(saved.path)
      if (!workflow || !workflow.isPersisted) {
        toast.error(t('workflowService.privateLinkFileUnavailable'))
        return 'failed'
      }
      if (!(await workflowService.openWorkflow(workflow, { isCurrent }))) {
        toast.error(t('workflowService.privateLinkUnavailable'))
        return 'failed'
      }
      return 'loaded'
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
      await clearIntent(link.workflowId)
    }
  }

  function openSavedWorkflowFromUrl(): Promise<SavedWorkflowUrlLoadStatus> {
    pending ??= load().finally(() => {
      pending = null
    })
    return pending
  }
  return { openSavedWorkflowFromUrl }
}
import { tryOnScopeDispose } from '@vueuse/core'
import { watch } from 'vue'
