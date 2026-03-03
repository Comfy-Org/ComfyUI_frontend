import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import OpenSharedWorkflowDialogContent from '@/platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import type { AssetInfo } from '@/schemas/apiSchema'
import {
  SharedWorkflowLoadError,
  useWorkflowShareService
} from '@/platform/workflow/sharing/services/workflowShareService'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

type SharedWorkflowUrlLoadStatus = 'not-present' | 'loaded' | 'failed'

export function useSharedWorkflowUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()
  const workflowShareService = useWorkflowShareService()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
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

  async function discoverNonOwnedAssets(): Promise<AssetInfo[] | null> {
    try {
      const { output } = await app.graphToPrompt()
      const raw = await api.getShareableAssets(output, { owned: false })
      return raw.assets.filter((a) => !a.in_library)
    } catch {
      return null
    }
  }

  function showOpenSharedWorkflowDialog(
    workflowName: string,
    nonOwnedAssets: AssetInfo[] | null
  ): Promise<boolean> {
    const dialogKey = 'open-shared-workflow'
    const items = nonOwnedAssets ?? []

    return new Promise<boolean>((resolve) => {
      dialogService.showLayoutDialog({
        key: dialogKey,
        component: OpenSharedWorkflowDialogContent,
        props: {
          workflowName,
          items,
          onConfirm: () => {
            resolve(true)
            dialogStore.closeDialog({ key: dialogKey })
          },
          onCancel: () => {
            resolve(false)
            dialogStore.closeDialog({ key: dialogKey })
          }
        },
        dialogComponentProps: {
          onClose: () => resolve(false),
          pt: {
            root: {
              class: 'rounded-2xl overflow-hidden w-full sm:w-176 max-w-full'
            }
          }
        }
      })
    })
  }

  function extractWorkflowName(
    name: string,
    workflowJson: Record<string, unknown>
  ): string {
    if (name) return name
    if (typeof workflowJson.name === 'string' && workflowJson.name) {
      return workflowJson.name
    }
    return t('openSharedWorkflow.dialogTitle')
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

      const workflowName = extractWorkflowName(
        sharedWorkflow.name,
        sharedWorkflow.workflowJson as unknown as Record<string, unknown>
      )
      const nonOwnedAssets = await discoverNonOwnedAssets()

      const hasImportableAssets = (nonOwnedAssets?.length ?? 0) > 0

      const confirmed = await showOpenSharedWorkflowDialog(
        workflowName,
        nonOwnedAssets
      )

      if (confirmed && hasImportableAssets) {
        try {
          await workflowShareService.getSharedWorkflow(shareParam, {
            import: true
          })
        } catch (importError) {
          console.error(
            '[useSharedWorkflowUrlLoader] Failed to import assets:',
            importError
          )
          toast.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('openSharedWorkflow.importFailed'),
            life: 3000
          })
        }
      }

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
