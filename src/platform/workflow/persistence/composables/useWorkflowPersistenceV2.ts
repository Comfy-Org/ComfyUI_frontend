/**
 * V2 Workflow Persistence Composable
 *
 * Key changes from V1:
 * - Uses V2 draft store with per-draft keys
 * - Uses tab state composable for session pointers
 * - Adds 512ms debounce on graph change persistence
 * - Runs V1→V2 migration on first load
 */

import { debounce } from 'es-toolkit'
import { useToast } from 'primevue'
import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { PERSIST_DEBOUNCE_MS } from '../base/draftTypes'
import { createFailedToSaveDraftToast } from '../base/draftToast'
import { clearAllV2Storage } from '../base/storageIO'
import { migrateV1toV2 } from '../migration/migrateV1toV2'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowTabState } from './useWorkflowTabState'
import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'

interface RestorableTabState {
  paths: string[]
  activeIndex: number
}

export function useWorkflowPersistenceV2() {
  const { t } = useI18n()
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()
  const route = useRoute()
  const router = useRouter()
  const sharedWorkflowUrlLoader = useSharedWorkflowUrlLoader()
  const templateUrlLoader = useTemplateUrlLoader()
  const TEMPLATE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.TEMPLATE
  const draftStore = useWorkflowDraftStoreV2()
  const tabState = useWorkflowTabState()
  const toast = useToast()
  const { onUserLogout } = useCurrentUser()

  // Run migration on module load, passing clientId for tab state migration
  migrateV1toV2(undefined, api.clientId ?? api.initialClientId ?? undefined)

  // Clear workflow persistence storage when user signs out (cloud only)
  onUserLogout(() => {
    if (isCloud) {
      clearAllV2Storage()
    }
  })

  const ensureTemplateQueryFromIntent = async () => {
    hydratePreservedQuery(TEMPLATE_NAMESPACE)
    const mergedQuery = mergePreservedQueryIntoQuery(
      TEMPLATE_NAMESPACE,
      route.query
    )

    if (mergedQuery) {
      await router.replace({ query: mergedQuery })
    }

    return mergedQuery ?? route.query
  }

  const workflowPersistenceEnabled = computed(() =>
    settingStore.get('Comfy.Workflow.Persist')
  )

  const lastSavedJsonByPath = ref<Record<string, string>>({})

  watch(workflowPersistenceEnabled, (enabled) => {
    if (!enabled) {
      draftStore.reset()
      lastSavedJsonByPath.value = {}
    }
  })

  const persistCurrentWorkflow = () => {
    if (!workflowPersistenceEnabled.value) return
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) return

    const graphData = comfyApp.rootGraph.serialize()
    const workflowJson = JSON.stringify(graphData)
    const workflowPath = activeWorkflow.path

    // Skip if unchanged
    if (workflowJson === lastSavedJsonByPath.value[workflowPath]) return

    // Save to V2 draft store
    const saved = draftStore.saveDraft(workflowPath, workflowJson, {
      name: activeWorkflow.key,
      isTemporary: activeWorkflow.isTemporary
    })

    if (!saved) {
      toast.add(createFailedToSaveDraftToast(t))
      return
    }

    // Update session pointer
    tabState.setActivePath(workflowPath)

    lastSavedJsonByPath.value[workflowPath] = workflowJson

    // Clean up draft if workflow is saved and unmodified
    if (!activeWorkflow.isTemporary && !activeWorkflow.isModified) {
      draftStore.removeDraft(workflowPath)
    }
  }

  // Debounced version for graphChanged events
  const debouncedPersist = debounce(persistCurrentWorkflow, PERSIST_DEBOUNCE_MS)

  /**
   * Opens a saved workflow referenced by a persisted path pointer.
   *
   * Drafts are tried before this fallback because they contain unsaved workflow
   * JSON. This function only syncs workflow file metadata when the path is not
   * already known locally; it does not load every saved workflow body.
   */
  const openSavedWorkflowFromPath = async (path: string) => {
    let saved = workflowStore.getWorkflowByPath(path)
    if (!saved) {
      await workflowStore.loadWorkflows()
      saved = workflowStore.getWorkflowByPath(path)
    }
    if (!saved) return false

    await useWorkflowService().openWorkflow(saved)
    return true
  }

  const loadPreviousWorkflowFromStorage = async () => {
    const sessionPath = tabState.getActivePath()

    // 1. Try draft for session path
    if (
      sessionPath &&
      (await draftStore.loadPersistedWorkflow({
        workflowName: null,
        preferredPath: sessionPath
      }))
    )
      return true

    // 2. Try saved workflow by path (draft may not exist for saved+unmodified workflows)
    if (sessionPath) {
      if (await openSavedWorkflowFromPath(sessionPath)) {
        return true
      }
    }

    // 3. Fall back to most recent draft
    return await draftStore.loadPersistedWorkflow({
      workflowName: null,
      fallbackToLatestDraft: true
    })
  }

  const loadDefaultWorkflow = async () => {
    if (!settingStore.get('Comfy.TutorialCompleted')) {
      await settingStore.set('Comfy.TutorialCompleted', true)
      await useWorkflowService().loadBlankWorkflow()
      await useCommandStore().execute('Comfy.BrowseTemplates')
    } else {
      await comfyApp.loadGraphData()
    }
  }

  const getRestorableTabState = (): RestorableTabState | null => {
    const storedTabState = tabState.getOpenPaths()
    const paths = storedTabState?.paths ?? []
    const activeIndex = storedTabState?.activeIndex ?? -1

    if (paths.length === 0) return null
    if (activeIndex < 0 || activeIndex >= paths.length) return null
    return { paths, activeIndex }
  }

  const initializeWorkflow = async () => {
    if (!workflowPersistenceEnabled.value) {
      await loadDefaultWorkflow()
      tabStateRestored = true
      return
    }

    try {
      if (getRestorableTabState()) {
        await restoreWorkflowTabsState()
        return
      }

      const restored = await loadPreviousWorkflowFromStorage()
      if (!restored) {
        await loadDefaultWorkflow()
      }
    } catch (err) {
      console.error('Error loading previous workflow', err)
      await loadDefaultWorkflow()
    } finally {
      tabStateRestored = true
    }
  }

  const loadTemplateFromUrlIfPresent = async () => {
    const query = await ensureTemplateQueryFromIntent()
    const hasTemplateUrl = query.template && typeof query.template === 'string'

    if (hasTemplateUrl) {
      await templateUrlLoader.loadTemplateFromUrl()
    }
  }

  const loadSharedWorkflowFromUrlIfPresent = async () => {
    return await sharedWorkflowUrlLoader.loadSharedWorkflowFromUrl()
  }

  // Setup watchers
  watch(
    () => workflowStore.activeWorkflow?.key,
    (activeWorkflowKey) => {
      if (!activeWorkflowKey) return
      // Flush any pending persistence from the previous workflow
      debouncedPersist.flush()
      // Persist the new workflow immediately
      persistCurrentWorkflow()
    }
  )

  // Debounced persistence on graph changes
  api.addEventListener('graphChanged', debouncedPersist)

  // Clean up event listener when component unmounts
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', debouncedPersist)
    debouncedPersist.cancel()
  })

  // Restore workflow tabs states
  const openWorkflows = computed(() => workflowStore.openWorkflows)
  const activeWorkflow = computed(() => workflowStore.activeWorkflow)
  const restoreState = computed<{ paths: string[]; activeIndex: number }>(
    () => {
      if (!openWorkflows.value || !activeWorkflow.value) {
        return { paths: [], activeIndex: -1 }
      }

      const paths = openWorkflows.value
        .map((workflow) => workflow?.path)
        .filter(
          (path): path is string =>
            typeof path === 'string' && path.startsWith(ComfyWorkflow.basePath)
        )
      const activeIndex = paths.indexOf(activeWorkflow.value.path)

      return { paths, activeIndex }
    }
  )

  // Keep tab-state writes disabled until initialization has consumed any
  // stored tab pointer.
  let tabStateRestored = false

  watch(restoreState, ({ paths, activeIndex }) => {
    // Only persist after tab state has been restored to avoid
    // writing leaked data from wrong workspace during init
    if (workflowPersistenceEnabled.value && tabStateRestored) {
      tabState.setOpenPaths(paths, activeIndex)
    }
  })

  const restoreWorkflowTabsState = async () => {
    if (!workflowPersistenceEnabled.value) {
      tabStateRestored = true
      return
    }

    const storedTabState = getRestorableTabState()
    if (!storedTabState) {
      tabStateRestored = true
      return
    }

    await workflowStore.loadWorkflows()

    storedTabState.paths.forEach((path: string) => {
      if (workflowStore.getWorkflowByPath(path)) return
      const draft = draftStore.getDraft(path)
      if (!draft?.isTemporary) return
      try {
        const workflowData = JSON.parse(draft.data)
        workflowStore.createTemporary(draft.name, workflowData)
      } catch (err) {
        console.warn(
          'Failed to parse workflow draft, creating with default',
          err
        )
        draftStore.removeDraft(path)
        workflowStore.createTemporary(draft.name)
      }
    })

    workflowStore.openWorkflowsInBackground({
      left: storedTabState.paths.slice(0, storedTabState.activeIndex),
      right: storedTabState.paths.slice(storedTabState.activeIndex)
    })

    // Activate the correct workflow at storedActiveIndex
    const activePath = storedTabState.paths[storedTabState.activeIndex]
    const workflow = activePath
      ? workflowStore.getWorkflowByPath(activePath)
      : null
    if (workflow) {
      await useWorkflowService().openWorkflow(workflow)
    }

    tabStateRestored = true
  }

  return {
    initializeWorkflow,
    loadSharedWorkflowFromUrlIfPresent,
    loadTemplateFromUrlIfPresent
  }
}
