/**
 * V2 Workflow Persistence Composable
 *
 * Key changes from V1:
 * - Uses V2 draft store with per-draft keys
 * - Uses tab state composable for session pointers
 * - Adds 512ms debounce on graph change persistence
 */

import { debounce } from 'es-toolkit'
import { useToast } from 'primevue'
import { tryOnScopeDispose, until } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { PERSIST_DEBOUNCE_MS } from '../base/draftTypes'
import type { StartupOutcome } from '../base/draftTypes'
import {
  getStorageIdentity,
  getStorageScope,
  getStorageWriteGate,
  registerWorkflowPersistenceFlush
} from '../base/storageIO'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowTabState } from './useWorkflowTabState'
import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'

export function useWorkflowPersistenceV2() {
  const { t } = useI18n()
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()
  const route = useRoute()
  const router = useRouter()
  const sharedWorkflowUrlLoader = useSharedWorkflowUrlLoader()
  const templateUrlLoader = useTemplateUrlLoader()
  const TEMPLATE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.TEMPLATE
  const SHARE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.SHARE
  const draftStore = useWorkflowDraftStoreV2()
  const tabState = useWorkflowTabState()
  const toast = useToast()
  const teamWorkspaceStore = useTeamWorkspaceStore()

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
  let hasPendingPersistence = false
  let pendingPersistenceOwnerId: string | null = null
  let graphChangeRevision = 0

  watch(workflowPersistenceEnabled, (enabled) => {
    if (!enabled) {
      draftStore.reset()
      lastSavedJsonByPath.value = {}
    }
  })

  const persistCurrentWorkflow = () => {
    if (!workflowPersistenceEnabled.value) {
      hasPendingPersistence = false
      pendingPersistenceOwnerId = null
      return
    }
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) {
      hasPendingPersistence = false
      pendingPersistenceOwnerId = null
      return
    }

    const graphData = comfyApp.rootGraph.serialize()
    const workflowJson = JSON.stringify(graphData)
    const workflowPath = activeWorkflow.path

    // Skip if unchanged
    if (workflowJson === lastSavedJsonByPath.value[workflowPath]) {
      hasPendingPersistence = false
      pendingPersistenceOwnerId = null
      return
    }
    if (getStorageWriteGate() === 'deferred') return
    hasPendingPersistence = false
    pendingPersistenceOwnerId = null

    // Save to V2 draft store
    const saved = draftStore.saveDraft(workflowPath, workflowJson, {
      name: activeWorkflow.key,
      isTemporary: activeWorkflow.isTemporary
    })

    if (!saved) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('toastMessages.failedToSaveDraft')
      })
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

  function scheduleWorkflowPersistence(): void {
    graphChangeRevision++
    hasPendingPersistence = true
    pendingPersistenceOwnerId = getStorageIdentity()
    debouncedPersist()
  }

  function persistWorkflowForCurrentOwner(): void {
    hasPendingPersistence = true
    pendingPersistenceOwnerId = getStorageIdentity()
    persistCurrentWorkflow()
  }

  function flushPendingPersistence() {
    debouncedPersist.flush()
  }

  const unregisterPersistenceFlush = registerWorkflowPersistenceFlush(
    flushPendingPersistence
  )
  window.addEventListener('pagehide', flushPendingPersistence)

  function resetPersistenceForIdentityChange(clearPending: boolean): void {
    debouncedPersist.cancel()
    if (clearPending) {
      hasPendingPersistence = false
      pendingPersistenceOwnerId = null
    }
    lastSavedJsonByPath.value = {}
  }

  let observedStorageIdentity = getStorageIdentity()
  let hasResolvedStorageIdentity = observedStorageIdentity !== null
  watch(
    getStorageIdentity,
    (identity) => {
      if (identity === observedStorageIdentity) return
      observedStorageIdentity = identity
      resetPersistenceForIdentityChange(hasResolvedStorageIdentity)
      if (identity !== null) hasResolvedStorageIdentity = true
    },
    { flush: 'sync' }
  )

  watch(
    getStorageWriteGate,
    (gate) => {
      if (
        gate === 'open' &&
        hasPendingPersistence &&
        (pendingPersistenceOwnerId === null ||
          pendingPersistenceOwnerId === getStorageIdentity())
      ) {
        debouncedPersist.cancel()
        persistCurrentWorkflow()
      }
    },
    { flush: 'sync' }
  )

  const loadPreviousWorkflowFromStorage = async () => {
    const sessionPath = tabState.getActivePath()

    // 1. Try draft for session path
    if (
      sessionPath &&
      (await draftStore.loadPersistedWorkflow({
        preferredPath: sessionPath
      }))
    )
      return true

    // 2. Try saved workflow by path (draft may not exist for saved+unmodified workflows)
    if (sessionPath) {
      const saved = workflowStore.getWorkflowByPath(sessionPath)
      if (saved) {
        await useWorkflowService().openWorkflow(saved)
        return true
      }
    }

    // 3. Fall back to most recent draft
    return await draftStore.loadPersistedWorkflow({
      fallbackToLatestDraft: true
    })
  }

  /**
   * The blank canvas startup opens for itself is not the user's work, but the
   * active-workflow watcher has already saved it. Drop the draft and the
   * pointer to it, or the next boot restores it and reports `restored`.
   */
  const discardStartupBlankDraft = () => {
    const blank = workflowStore.activeWorkflow
    if (!blank?.isTemporary || blank.isModified) return

    debouncedPersist.cancel()
    draftStore.removeDraft(blank.path)
    delete lastSavedJsonByPath.value[blank.path]
    tabState.clearActivePathPointer()
  }

  const hasPreservedIntent = (namespace: string, key: string) => {
    if (typeof route.query[key] === 'string') return true
    hydratePreservedQuery(namespace)
    const merged = mergePreservedQueryIntoQuery(namespace, route.query)
    return typeof merged?.[key] === 'string'
  }

  const hasSharedWorkflowIntent = () =>
    hasPreservedIntent(SHARE_NAMESPACE, 'share')

  const hasTemplateUrlIntent = () =>
    hasPreservedIntent(TEMPLATE_NAMESPACE, 'template')

  const resolveStartupOutcome = async (): Promise<StartupOutcome> => {
    if (settingStore.get('Comfy.TutorialCompleted')) {
      await comfyApp.loadGraphData()
      return 'restored'
    }

    await useWorkflowService().loadBlankWorkflow()
    await nextTick()
    discardStartupBlankDraft()
    return hasSharedWorkflowIntent() || hasTemplateUrlIntent()
      ? 'url-intent'
      : 'fresh'
  }

  const getRestorableTabState = () => {
    const storedTabState = tabState.getOpenPaths()
    const paths = storedTabState?.paths ?? []
    const activeIndex = storedTabState?.activeIndex ?? -1

    if (paths.length === 0 || activeIndex < 0 || activeIndex >= paths.length) {
      return null
    }

    return { paths, activeIndex }
  }

  const initializeWorkflow = async (): Promise<StartupOutcome> => {
    if (!workflowPersistenceEnabled.value) {
      return await resolveStartupOutcome()
    }

    if (isCloud && getStorageScope() === null) {
      const revisionBeforeScopeResolution = graphChangeRevision
      await until(
        () =>
          getStorageScope() !== null || teamWorkspaceStore.initState === 'error'
      ).toBe(true)
      if (graphChangeRevision !== revisionBeforeScopeResolution) return 'fresh'
    }

    try {
      if (getRestorableTabState()) {
        // GraphCanvas calls restoreWorkflowTabsState next; skip the single-workflow
        // fallback here so the saved tab order and active index drive startup.
        return 'restored'
      }

      await workflowStore.loadWorkflows()
      const restored = await loadPreviousWorkflowFromStorage()
      return restored ? 'restored' : await resolveStartupOutcome()
    } catch (err) {
      console.error('Error loading previous workflow', err)
      return await resolveStartupOutcome()
    }
  }

  const loadTemplateFromUrlIfPresent = async () => {
    const query = await ensureTemplateQueryFromIntent()
    const hasTemplateUrl = query.template && typeof query.template === 'string'

    return hasTemplateUrl
      ? await templateUrlLoader.loadTemplateFromUrl()
      : undefined
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
      persistWorkflowForCurrentOwner()
    }
  )

  // Debounced persistence on graph changes
  api.addEventListener('graphChanged', scheduleWorkflowPersistence)

  // Clean up event listener when component unmounts
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', scheduleWorkflowPersistence)
    window.removeEventListener('pagehide', flushPendingPersistence)
    unregisterPersistenceFlush()
    debouncedPersist.cancel()
  })

  // Restore workflow tabs states
  const openWorkflows = computed(() => workflowStore.openWorkflows)
  const activeWorkflow = computed(() => workflowStore.activeWorkflow)
  const restoreState = computed<{ paths: string[]; activeIndex: number }>(
    () => {
      const active = getActiveWorkflow()
      if (!active) return { paths: [], activeIndex: -1 }
      const paths = openWorkflows.value
        .map((workflow) => workflow.path)
        .filter(
          (path): path is string =>
            typeof path === 'string' && path.startsWith(ComfyWorkflow.basePath)
        )
      const activeIndex = paths.indexOf(active.path)

      return { paths, activeIndex }
    }
  )

  function getActiveWorkflow(): ComfyWorkflow | null {
    return activeWorkflow.value
  }

  // Track whether tab state has been properly restored to avoid
  // overwriting with stale data during initialization
  let tabStateRestored = false

  watch(restoreState, ({ paths, activeIndex }) => {
    // Only persist after tab state has been restored to avoid
    // writing leaked data from wrong workspace during init
    if (workflowPersistenceEnabled.value && tabStateRestored) {
      tabState.setOpenPaths(paths, activeIndex)
    }
  })

  /**
   * Restores saved workflow tabs after initializeWorkflow skips the single-workflow fallback.
   * GraphCanvas must call this during startup when workflow persistence is enabled.
   */
  const restoreWorkflowTabsState = async () => {
    if (!workflowPersistenceEnabled.value) {
      tabStateRestored = true
      return
    }

    try {
      await workflowStore.loadWorkflows()
    } catch (err) {
      console.error('Error loading workflows for tab restore', err)
      await resolveStartupOutcome()
      tabStateRestored = true
      return
    }

    const restorableTabState = getRestorableTabState()
    if (!restorableTabState) {
      tabStateRestored = true
      return
    }
    const { paths: storedWorkflows, activeIndex: storedActiveIndex } =
      restorableTabState

    storedWorkflows.forEach((path: string) => {
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
      left: storedWorkflows.slice(0, storedActiveIndex),
      right: storedWorkflows.slice(storedActiveIndex)
    })

    tabStateRestored = true

    // Activate the correct workflow at storedActiveIndex
    const activePath = storedWorkflows[storedActiveIndex]
    const workflow = activePath
      ? workflowStore.getWorkflowByPath(activePath)
      : null
    if (workflow) {
      await useWorkflowService().openWorkflow(workflow)
    }
  }

  return {
    initializeWorkflow,
    loadSharedWorkflowFromUrlIfPresent,
    loadTemplateFromUrlIfPresent,
    restoreWorkflowTabsState
  }
}
