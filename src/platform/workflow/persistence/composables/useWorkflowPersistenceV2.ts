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
import { tryOnScopeDispose, whenever } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
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
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { PERSIST_DEBOUNCE_MS } from '../base/draftTypes'
import type { StartupOutcome } from '../base/draftTypes'
import {
  clearAllWorkflowStorage,
  completeWorkflowLogoutTransition,
  prepareWorkflowLogoutTransition,
  registerWorkflowPersistenceFlush
} from '../base/storageIO'
import {
  withWorkflowViewState,
  workflowViewStateEqual
} from '../base/workflowViewState'
import { migrateV1toV2 } from '../migration/migrateV1toV2'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowTabState } from './useWorkflowTabState'

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
  const { onUserLogout, onUserResolved } = useCurrentUser()
  const teamWorkspaceStore = useTeamWorkspaceStore()
  let stopWorkspaceReadinessWatcher: (() => void) | undefined

  function stopPendingWorkspaceReadinessWatcher(): void {
    stopWorkspaceReadinessWatcher?.()
    stopWorkspaceReadinessWatcher = undefined
  }

  // Run migration before the draft index is consumed. Reset a potentially
  // primed cache when migration repaired or created V2 storage.
  const migrationResult = migrateV1toV2(
    undefined,
    api.clientId ?? api.initialClientId ?? undefined
  )
  const migrationMutatedV2Storage = migrationResult >= 0
  if (migrationMutatedV2Storage) draftStore.reset()

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

  const getCurrentWorkflowDraft = (): {
    state: ComfyWorkflowJSON
    json: string
  } => {
    const graphData =
      comfyApp.rootGraph.serialize() as unknown as ComfyWorkflowJSON
    const state = withWorkflowViewState(
      graphData,
      comfyApp.canvas.ds,
      settingStore.get('Comfy.EnableWorkflowViewRestore')
    )
    return { state, json: JSON.stringify(state) }
  }

  const persistCurrentWorkflow = () => {
    if (draftStore.isPersistencePaused() || !workflowPersistenceEnabled.value)
      return
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) return

    const { state: draftState, json: workflowJson } = getCurrentWorkflowDraft()
    const workflowPath = activeWorkflow.path

    // Skip if unchanged, including the persisted viewport snapshot.
    if (workflowJson === lastSavedJsonByPath.value[workflowPath]) return

    let saved = false
    try {
      saved = draftStore.saveDraft(workflowPath, workflowJson, {
        name: activeWorkflow.key,
        isTemporary: activeWorkflow.isTemporary,
        isModified: activeWorkflow.isModified
      })
    } catch (error) {
      console.error('Failed to persist workflow draft', error)
    }

    if (!saved) {
      if (draftStore.shouldNotifySaveFailure()) {
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('toastMessages.failedToSaveDraft')
        })
      }
      return
    }

    draftStore.markSaveSucceeded()

    // Update session pointer
    tabState.setActivePath(workflowPath)

    lastSavedJsonByPath.value[workflowPath] = workflowJson

    const savedViewState = activeWorkflow.initialState.extra?.ds
    const draftViewState = draftState.extra?.ds
    if (
      !activeWorkflow.isTemporary &&
      !activeWorkflow.isModified &&
      workflowViewStateEqual(savedViewState, draftViewState)
    ) {
      draftStore.removeDraft(workflowPath)
    }
  }

  // Debounced version for graphChanged events
  const debouncedPersist = debounce(persistCurrentWorkflow, PERSIST_DEBOUNCE_MS)

  function flushPendingPersistence() {
    // Preserve #14575's pending-edit flush, then take one final snapshot so a
    // viewport-only move after the last graph change is not lost on pagehide or
    // a workspace transition.
    debouncedPersist.flush()
    persistCurrentWorkflow()
  }

  const unregisterPersistenceFlush = registerWorkflowPersistenceFlush(
    flushPendingPersistence
  )
  window.addEventListener('pagehide', flushPendingPersistence)

  onUserLogout(() => {
    if (!isCloud) return
    stopPendingWorkspaceReadinessWatcher()
    debouncedPersist.cancel()
    prepareWorkflowLogoutTransition()
    clearAllWorkflowStorage()
  })
  onUserResolved(() => {
    if (!isCloud) return
    stopPendingWorkspaceReadinessWatcher()

    // Release the fence once initialization concludes either way: a resolved
    // workspace, or a permanent init failure. Waiting on 'ready' alone would
    // leave writes blocked for the rest of the session if init settles on
    // 'error' (e.g. no workspaces available, retries exhausted).
    const isWorkspaceInitConcluded = () =>
      (teamWorkspaceStore.initState === 'ready' &&
        teamWorkspaceStore.activeWorkspaceId !== null) ||
      teamWorkspaceStore.initState === 'error'
    if (isWorkspaceInitConcluded()) {
      completeWorkflowLogoutTransition()
      return
    }

    stopWorkspaceReadinessWatcher = whenever(
      isWorkspaceInitConcluded,
      () => {
        stopWorkspaceReadinessWatcher = undefined
        completeWorkflowLogoutTransition()
      },
      { once: true }
    )
  })

  const runWithPersistencePaused = async <T>(
    operation: () => Promise<T>
  ): Promise<T> => {
    const resumePersistence = draftStore.pausePersistence()
    try {
      return await operation()
    } finally {
      // Graph loads emit graphChanged. Discard any startup-only trailing save
      // before allowing user-driven persistence again.
      debouncedPersist.cancel()
      resumePersistence()
    }
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
      const saved = workflowStore.getWorkflowByPath(sessionPath)
      if (saved) {
        await useWorkflowService().openWorkflow(saved)
        return true
      }
    }

    // 3. Fall back to most recent draft
    return await draftStore.loadPersistedWorkflow({
      workflowName: null,
      fallbackToLatestDraft: true
    })
  }

  /**
   * The blank canvas startup opens for itself is not the user's work. Current
   * startup persistence is paused, while older builds may already have saved
   * this path. Drop any stale draft/pointer so it cannot win the next restore.
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
    const outcome = await runWithPersistencePaused(async () => {
      if (!workflowPersistenceEnabled.value) {
        return await resolveStartupOutcome()
      }

      try {
        if (getRestorableTabState()) {
          // GraphCanvas calls restoreWorkflowTabsState next; skip the single-workflow
          // fallback here so the saved tab order and active index drive startup.
          return 'restored' as const
        }

        await workflowStore.loadWorkflows()
        const restored = await loadPreviousWorkflowFromStorage()
        return restored ? ('restored' as const) : await resolveStartupOutcome()
      } catch (err) {
        console.error('Error loading previous workflow', err)
        return await resolveStartupOutcome()
      }
    })

    const startupWorkflow = workflowStore.activeWorkflow
    if (
      workflowPersistenceEnabled.value &&
      startupWorkflow?.isTemporary &&
      startupWorkflow.isModified &&
      !draftStore.getDraft(startupWorkflow.path)
    ) {
      // A loader can produce genuine unsaved work during startup. It was
      // intentionally suppressed while activation/graph-change noise ran, so
      // persist it once after startup rather than losing it.
      persistCurrentWorkflow()
    }

    return outcome
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
    () => workflowStore.activeWorkflow,
    (activeWorkflow) => {
      if (!activeWorkflow) return
      // beforeLoadNewGraph owns the outgoing synchronous draft save. A pending
      // graphChanged callback belongs to the old graph, so cancel it rather
      // than resolving it against the newly active workflow.
      debouncedPersist.cancel()
      if (draftStore.isPersistencePaused() || !workflowPersistenceEnabled.value)
        return

      // Updating the active pointer is cheap and does not require serializing
      // the newly opened graph. A new temporary workflow gets its first draft
      // through the normal debounce, keeping workflow switching non-blocking.
      tabState.setActivePath(activeWorkflow.path)
      if (activeWorkflow.isTemporary) {
        debouncedPersist()
      }
    }
  )

  // Debounced persistence on graph changes
  api.addEventListener('graphChanged', debouncedPersist)

  // Clean up event listener when component unmounts
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', debouncedPersist)
    window.removeEventListener('pagehide', flushPendingPersistence)
    unregisterPersistenceFlush()
    debouncedPersist.cancel()
    stopPendingWorkspaceReadinessWatcher()
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
  const restoreWorkflowTabsState = async () =>
    await runWithPersistencePaused(async () => {
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

      for (const path of storedWorkflows) {
        if (workflowStore.getWorkflowByPath(path)) continue
        const draft = draftStore.getDraft(path)
        if (!draft?.isTemporary) continue
        try {
          const parsedWorkflowData = JSON.parse(draft.data)
          const workflowData = await validateComfyWorkflow(parsedWorkflowData)
          if (!workflowData) {
            draftStore.removeDraft(path)
            workflowStore.createTemporary(draft.name)
            continue
          }
          workflowStore.createTemporary(draft.name, workflowData)
        } catch (err) {
          console.warn(
            'Failed to parse workflow draft, creating with default',
            err
          )
          draftStore.removeDraft(path)
          workflowStore.createTemporary(draft.name)
        }
      }

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
    })

  return {
    initializeWorkflow,
    loadSharedWorkflowFromUrlIfPresent,
    loadTemplateFromUrlIfPresent,
    restoreWorkflowTabsState
  }
}
