import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import {
  SharedWorkflowLoadError,
  useWorkflowShareService
} from '@/platform/workflow/sharing/services/workflowShareService'
import { app } from '@/scripts/app'

type SharedWorkflowUrlLoadStatus = 'not-present' | 'loaded' | 'failed'

export function useSharedWorkflowUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()
  const workflowShareService = useWorkflowShareService()
  const SHARE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.SHARE

  function isValidParameter(param: string): boolean {
    return /^[a-zA-Z0-9_.-]+$/.test(param)
  }

  async function ensureShareQueryFromIntent() {
    hydratePreservedQuery(SHARE_NAMESPACE)
    const mergedQuery = mergePreservedQueryIntoQuery(
      SHARE_NAMESPACE,
      route.query
    )

    if (mergedQuery) {
      await router.replace({ query: mergedQuery })
    }

    return mergedQuery ?? route.query
  }

  function cleanupUrlParams() {
    const newQuery = { ...route.query }
    delete newQuery.share
    void router.replace({ query: newQuery })
  }

  function shouldRetainShareQuery(error: unknown): boolean {
    if (error instanceof SharedWorkflowLoadError) {
      return error.isRetryable
    }
    return true
  }

  async function loadSharedWorkflowFromUrl(): Promise<SharedWorkflowUrlLoadStatus> {
    let shouldCleanupShareQuery = false
    const query = await ensureShareQueryFromIntent()
    const shareParam = query.share

    if (!shareParam || typeof shareParam !== 'string') {
      return 'not-present'
    }

    if (!isValidParameter(shareParam)) {
      console.warn(
        `[useSharedWorkflowUrlLoader] Invalid share parameter format: ${shareParam}`
      )
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('shareWorkflow.loadFailed'),
        life: 3000
      })
      cleanupUrlParams()
      clearPreservedQuery(SHARE_NAMESPACE)
      return 'failed'
    }

    try {
      const sharedWorkflow =
        await workflowShareService.getSharedWorkflow(shareParam)
      await app.loadGraphData(
        sharedWorkflow.workflowJson,
        true,
        true,
        shareParam
      )
      shouldCleanupShareQuery = true
      return 'loaded'
    } catch (error) {
      console.error(
        '[useSharedWorkflowUrlLoader] Failed to load shared workflow from URL:',
        error
      )
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail:
          error instanceof Error
            ? error.message
            : t('shareWorkflow.loadFailed'),
        life: 3000
      })
      shouldCleanupShareQuery = !shouldRetainShareQuery(error)
      return 'failed'
    } finally {
      if (shouldCleanupShareQuery) {
        cleanupUrlParams()
        clearPreservedQuery(SHARE_NAMESPACE)
      }
    }
  }

  return {
    loadSharedWorkflowFromUrl
  }
}
