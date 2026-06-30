import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useTelemetry } from '@/platform/telemetry'
import OpenSharedWorkflowDialogContent from '@/platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue'
import type { SharedWorkflowPayload } from '@/platform/workflow/sharing/types/shareTypes'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import { isValidShareId } from '@/platform/workflow/sharing/utils/shareAuthAttribution'
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

type OpeningAction = Exclude<DialogResult['action'], 'cancel'>

const OPEN_SHARED_WORKFLOW_DIALOG_KEY = 'open-shared-workflow'

export function useSharedWorkflowUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()
  const workflowShareService = useWorkflowShareService()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const templateSelectorDialog = useWorkflowTemplateSelectorDialog()
  const { isLoggedIn } = useCurrentUser()
  const { mode, isAppMode } = useAppMode()
  const SHARE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.SHARE

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

  function clearShareIntent() {
    cleanupUrlParams()
    clearPreservedQuery(SHARE_NAMESPACE)
  }

  function showOpenSharedWorkflowDialog(
    shareId: string
  ): Promise<DialogResult> {
    function setOpeningAction(openingAction: OpeningAction) {
      dialogStore.updateDialog({
        key: OPEN_SHARED_WORKFLOW_DIALOG_KEY,
        contentProps: { openingAction }
      })
    }

    return new Promise<DialogResult>((resolve) => {
      dialogService.showLayoutDialog({
        key: OPEN_SHARED_WORKFLOW_DIALOG_KEY,
        component: OpenSharedWorkflowDialogContent,
        props: {
          shareId,
          openingAction: null,
          onConfirm: (payload: SharedWorkflowPayload) => {
            setOpeningAction('copy-and-open')
            resolve({ action: 'copy-and-open', payload })
          },
          onOpenWithoutImporting: (payload: SharedWorkflowPayload) => {
            setOpeningAction('open-only')
            resolve({ action: 'open-only', payload })
          },
          onCancel: () => {
            resolve({ action: 'cancel' })
            dialogStore.closeDialog({ key: OPEN_SHARED_WORKFLOW_DIALOG_KEY })
          }
        },
        dialogComponentProps: {
          onClose: () => resolve({ action: 'cancel' }),
          contentClass: 'sm:max-w-176 rounded-2xl overflow-hidden'
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
      clearShareIntent()
      return 'not-present'
    }

    if (!isValidShareId(shareParam)) {
      console.warn(
        `[useSharedWorkflowUrlLoader] Invalid share parameter format: ${shareParam}`
      )
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('shareWorkflow.loadFailed')
      })
      clearShareIntent()
      return 'failed'
    }

    useTelemetry()?.trackShareLinkOpened({
      share_id: shareParam,
      is_authenticated: isLoggedIn.value,
      view_mode: mode.value,
      is_app_mode: isAppMode.value
    })

    const result = await showOpenSharedWorkflowDialog(shareParam)

    if (result.action === 'cancel') {
      clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SHARE_AUTH)
      clearShareIntent()
      return 'cancelled'
    }

    templateSelectorDialog.hide()

    try {
      const { payload } = result
      const workflowName = payload.name || t('openSharedWorkflow.dialogTitle')
      const nonOwnedAssets = payload.assets.filter((a) => !a.in_library)
      let importFailed = false

      if (result.action === 'copy-and-open' && nonOwnedAssets.length > 0) {
        try {
          await workflowShareService.importPublishedAssets(
            nonOwnedAssets.map((a) => a.id),
            payload.shareId
          )
        } catch (importError) {
          importFailed = true
          console.error(
            '[useSharedWorkflowUrlLoader] Failed to import assets:',
            importError
          )
          toast.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('openSharedWorkflow.importFailed')
          })
        }
      }

      try {
        await app.loadGraphData(
          payload.workflowJson,
          true,
          true,
          workflowName,
          {
            openSource: 'shared_url',
            shareId: payload.shareId
          }
        )
      } catch (error) {
        console.error(
          '[useSharedWorkflowUrlLoader] Failed to load workflow graph:',
          error
        )
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('shareWorkflow.loadFailed')
        })
        clearShareIntent()
        return 'failed'
      }

      clearShareIntent()
      return importFailed ? 'loaded-without-assets' : 'loaded'
    } finally {
      dialogStore.closeDialog({ key: OPEN_SHARED_WORKFLOW_DIALOG_KEY })
    }
  }

  return {
    loadSharedWorkflowFromUrl
  }
}
