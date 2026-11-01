/**
 * V2 Workflow Persistence Composable
 *
 * Key changes from V1:
 * - Uses V2 draft store with per-draft keys
 * - Uses tab state composable for session pointers
 * - Adds 512ms debounce on graph change persistence
 */

import { reportError } from '@comfyorg/telemetry/reportError'
import { debounce } from 'es-toolkit'
import { useToast } from '@/components/ui/toast/toastStore'
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
import { useFolderWorkflowsUrlLoader } from '@/platform/workflow/management/composables/useFolderWorkflowsUrlLoader'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { PERSIST_DEBOUNCE_MS } from '@/platform/workflow/persistence/base/draftTypes'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import {
  clearWorkflowRestoreState,
  getStorageIdentity,
  getStorageScope,
  getStorageWriteGate,
  registerWorkflowPersistenceFlush
} from '@/platform/workflow/persistence/base/storageIO'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
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
  const folderWorkflowsUrlLoader = useFolderWorkflowsUrlLoader()
  let openedFolderWorkflows = false
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
  let tabPersistencePhase: 'startup' | 'waiting-for-owner' | 'ready' = 'startup'

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
      toast.error(t('g.error'), {
        description: t('toastMessages.failedToSaveDraft')
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
  let identityTransitionVersion = 0
  let identityTransition = Promise.resolve()

  const isWorkspaceInitConcluded = () =>
    (teamWorkspaceStore.initState === 'ready' &&
      teamWorkspaceStore.activeWorkspaceId !== null) ||
    teamWorkspaceStore.initState === 'error'

  async function waitForRestoreIdentity(): Promise<() => boolean> {
    const revisionBeforeScopeResolution = graphChangeRevision
    if (isCloud && getStorageScope() === null) {
      await until(
        () => getStorageScope() !== null || isWorkspaceInitConcluded()
      ).toBe(true)
    }
    const restoreVersion = identityTransitionVersion
    const restoreIdentity = getStorageIdentity()
    if (isCloud) await identityTransition
    return () =>
      revisionBeforeScopeResolution === graphChangeRevision &&
      restoreVersion === identityTransitionVersion &&
      restoreIdentity === getStorageIdentity()
  }

  function queueIdentityTransition(identity: string | null): void {
    const transitionVersion = ++identityTransitionVersion
    clearWorkflowRestoreState()
    identityTransition = identityTransition
      .then(async () => {
        if (transitionVersion !== identityTransitionVersion) return
        workflowStore.resetForIdentityChange()
        await useWorkflowService().loadBlankWorkflow()
        if (transitionVersion !== identityTransitionVersion) return
        if (
          transitionVersion !== identityTransitionVersion ||
          identity === null
        )
          return
        await until(
          () =>
            getStorageWriteGate() === 'open' ||
            teamWorkspaceStore.initState === 'error'
        ).toBe(true)
        if (
          transitionVersion !== identityTransitionVersion ||
          getStorageWriteGate() !== 'open'
        )
          return
        await workflowStore.loadWorkflows()
        if (transitionVersion !== identityTransitionVersion) return
        await draftStore.loadPersistedWorkflow({
          fallbackToLatestDraft: true,
          isCurrent: () => transitionVersion === identityTransitionVersion
        })
      })
      .catch((error: unknown) => {
        reportError(error, {
          surface: 'graph',
          errorType: 'workflow_identity_transition_failed'
        })
      })
  }

  watch(
    getStorageIdentity,
    (identity) => {
      if (identity === observedStorageIdentity) return
      observedStorageIdentity = identity
      resetPersistenceForIdentityChange(hasResolvedStorageIdentity)
      if (hasResolvedStorageIdentity) {
        tabPersistencePhase = 'waiting-for-owner'
        queueIdentityTransition(identity)
      }
      if (identity !== null) hasResolvedStorageIdentity = true
    },
    { flush: 'sync' }
  )

  watch(
    getStorageWriteGate,
    (gate) => {
      if (gate === 'open' && tabPersistencePhase === 'waiting-for-owner') {
        tabPersistencePhase = 'ready'
      }
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

  const loadPreviousWorkflowFromStorage = async (isCurrent: () => boolean) => {
    const sessionPath = tabState.getActivePath()

    if (
      sessionPath &&
      (await draftStore.loadPersistedWorkflow({
        preferredPath: sessionPath,
        isCurrent
      }))
    )
      return true

    if (!isCurrent()) return false
    if (sessionPath) {
      const saved = workflowStore.getWorkflowByPath(sessionPath)
      if (saved) {
        const opened = await useWorkflowService().openWorkflow(saved, {
          isCurrent
        })
        if (opened) return true
      }
    }

    return await draftStore.loadPersistedWorkflow({
      fallbackToLatestDraft: true,
      isCurrent
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
    openedFolderWorkflows =
      await folderWorkflowsUrlLoader.openFolderWorkflowsFromUrl()
    if (openedFolderWorkflows) return 'restored'

    if (!workflowPersistenceEnabled.value) {
      return await resolveStartupOutcome()
    }

    const isRestoreCurrent = await waitForRestoreIdentity()
    if (!isRestoreCurrent()) return 'fresh'

    try {
      if (getRestorableTabState()) {
        return 'restored'
      }

      await workflowStore.loadWorkflows()
      if (!isRestoreCurrent()) return 'restored'
      const restored = await loadPreviousWorkflowFromStorage(isRestoreCurrent)
      if (!isRestoreCurrent()) return 'restored'
      return restored ? 'restored' : await resolveStartupOutcome()
    } catch (err) {
      reportError(err, {
        surface: 'graph',
        errorType: 'workflow_restore_failed'
      })
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

  watch(
    restoreState,
    ({ paths, activeIndex }) => {
      if (workflowPersistenceEnabled.value && tabPersistencePhase === 'ready') {
        tabState.setOpenPaths(paths, activeIndex)
      }
    },
    { flush: 'sync' }
  )

  /**
   * Restores saved workflow tabs after initializeWorkflow skips the single-workflow fallback.
   * GraphCanvas must call this during startup when workflow persistence is enabled.
   */
  const restoreWorkflowTabsState = async () => {
    try {
      await restoreSavedTabs()
    } finally {
      workflowStore.markTabsRestored()
    }
  }

  const restoreSavedTabs = async () => {
    if (!workflowPersistenceEnabled.value) {
      tabPersistencePhase = 'ready'
      return
    }

    const isRestoreCurrent = await waitForRestoreIdentity()

    try {
      await workflowStore.loadWorkflows()
    } catch (err) {
      reportError(err, {
        surface: 'graph',
        errorType: 'workflow_tab_restore_failed'
      })
      await resolveStartupOutcome()
      tabPersistencePhase = 'ready'
      return
    }

    const restorableTabState = isRestoreCurrent()
      ? getRestorableTabState()
      : null
    if (!restorableTabState) {
      tabPersistencePhase = 'ready'
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

    tabPersistencePhase = 'ready'
    if (openedFolderWorkflows) return

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
