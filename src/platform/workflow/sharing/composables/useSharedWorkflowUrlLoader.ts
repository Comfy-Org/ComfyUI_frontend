import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import OpenSharedWorkflowDialogContent from '@/platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue'
import type { SharedWorkflowPayload } from '@/platform/workflow/sharing/types/shareTypes'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

type SharedWorkflowUrlLoadStatus =
  | 'not-present'
  | 'loaded'
  | 'loaded-without-assets'
  | 'cancelled'
  | 'failed'

type DialogResult =
  | { action: 'copy-and-open'; payload: SharedWorkflowPayload }
  | { action: 'open-only'; payload: SharedWorkflowPayload }
  | { action: 'cancel' }

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

  function showOpenSharedWorkflowDialog(
    shareId: string
  ): Promise<DialogResult> {
    const dialogKey = 'open-shared-workflow'

    return new Promise<DialogResult>((resolve) => {
      dialogService.showLayoutDialog({
        key: dialogKey,
        component: OpenSharedWorkflowDialogContent,
        props: {
          shareId,
          onConfirm: (payload: SharedWorkflowPayload) => {
            resolve({ action: 'copy-and-open', payload })
            dialogStore.closeDialog({ key: dialogKey })
          },
          onOpenWithoutImporting: (payload: SharedWorkflowPayload) => {
            resolve({ action: 'open-only', payload })
            dialogStore.closeDialog({ key: dialogKey })
          },
          onCancel: () => {
            resolve({ action: 'cancel' })
            dialogStore.closeDialog({ key: dialogKey })
          }
        },
        dialogComponentProps: {
          onClose: () => resolve({ action: 'cancel' }),
          pt: {
            root: {
              class: 'rounded-2xl overflow-hidden w-full sm:w-176 max-w-full'
            }
          }
        }
      })
    })
  }

  async function loadSharedWorkflowFromUrl(): Promise<SharedWorkflowUrlLoadStatus> {
    const query = await ensureShareQueryFromIntent()
    const shareParam = query.share

    if (shareParam == null) {
      return 'not-present'
    }

    if (typeof shareParam !== 'string') {
      cleanupUrlParams()
      clearPreservedQuery(SHARE_NAMESPACE)
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

    const result = await showOpenSharedWorkflowDialog(shareParam)

    if (result.action === 'cancel') {
      cleanupUrlParams()
      clearPreservedQuery(SHARE_NAMESPACE)
      return 'cancelled'
    }

    const { payload } = result
    const workflowName = payload.name || t('openSharedWorkflow.dialogTitle')
    const nonOwnedAssets = payload.assets.filter((a) => !a.in_library)

    try {
      await app.loadGraphData(payload.workflowJson, true, true, workflowName)
    } catch (error) {
      console.error(
        '[useSharedWorkflowUrlLoader] Failed to load workflow graph:',
        error
      )
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('shareWorkflow.loadFailed'),
        life: 5000
      })
      return 'failed'
    }

    if (result.action === 'copy-and-open' && nonOwnedAssets.length > 0) {
      try {
        await workflowShareService.importPublishedAssets(
          nonOwnedAssets.map((a) => a.id)
        )
      } catch (importError) {
        console.error(
          '[useSharedWorkflowUrlLoader] Failed to import assets:',
          importError
        )
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('openSharedWorkflow.importFailed')
        })
        cleanupUrlParams()
        clearPreservedQuery(SHARE_NAMESPACE)
        return 'loaded-without-assets'
      }
    }

    cleanupUrlParams()
    clearPreservedQuery(SHARE_NAMESPACE)
    return 'loaded'
  }

  return {
    loadSharedWorkflowFromUrl
  }
}
