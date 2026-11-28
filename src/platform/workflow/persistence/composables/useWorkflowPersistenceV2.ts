/**
 * V2 Workflow Persistence Composable
 *
 * Key changes from V1:
 * - Uses V2 draft store with per-draft keys
 * - Uses tab state composable for session pointers
 * - Adds 512ms debounce on graph change persistence
 */

import { debounce } from 'es-toolkit'
import { tryOnScopeDispose, until, whenever } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { isCloud } from '@/platform/distribution/types'
import { LOCAL_HANDOFF_PARAM } from '@/platform/openOnCloud/localHandoffProtocol'
import { useSettingStore } from '@/platform/settings/settingStore'
import { canCaptureCanvas } from '@/platform/workflow/core/canvasTrackerOwnership'
import { getLegacyWorkflowId } from '@/platform/workflow/core/utils/workflowId'
import { useLinkedWorkflowUrlLoader } from '@/platform/workflow/management/composables/useLinkedWorkflowUrlLoader'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { PERSIST_DEBOUNCE_MS } from '@/platform/workflow/persistence/base/draftTypes'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import {
  clearAllWorkspaceStorage,
  clearUnscopedDraftStorage,
  clearWorkflowRestoreState,
  fenceWorkflowStorageForAuthState,
  isWorkflowStorageTransitioning,
  prepareWorkflowLogoutTransition,
  releaseWorkflowStorageAuthFence,
  registerWorkflowPersistence
} from '@/platform/workflow/persistence/base/storageIO'
import { showDraftSaveFailedToast } from '@/platform/workflow/persistence/draftSaveFailureToast'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import {
  withWorkflowViewState,
  workflowViewStateEqual
} from '@/platform/workflow/persistence/base/workflowViewState'
import { useWorkflowTabState } from './useWorkflowTabState'
import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'
import { api } from '@/scripts/api'
import { useNewUserService } from '@/services/useNewUserService'
import { useApp } from '@/scripts/appInstance'
import { isValidUuid } from '@/utils/formatUtil'

const PERSIST_RETRY_BACKOFF_MS = 5_000

async function clearUnscopedDraftsAfterNewUserCheck(): Promise<void> {
  const newUserService = useNewUserService()
  await until(() => newUserService.isNewUser() !== null).toBe(true)
  clearUnscopedDraftStorage()
}

async function validateTemporaryDraftGraph(data: unknown) {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    isValidUuid(data.id)
  ) {
    return validateComfyWorkflow(data)
  }

  const { id, ...graph } = data
  const workflow = await validateComfyWorkflow(graph)
  const legacyId = typeof id === 'string' ? getLegacyWorkflowId(id) : undefined
  return workflow && legacyId ? { ...workflow, id: legacyId } : workflow
}

export function useWorkflowPersistenceV2() {
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()
  const route = useRoute()
  const router = useRouter()
  const sharedWorkflowUrlLoader = useSharedWorkflowUrlLoader()
  const templateUrlLoader = useTemplateUrlLoader()
  const linkedWorkflowUrlLoader = useLinkedWorkflowUrlLoader()
  let openedLinkedWorkflow = false
  const TEMPLATE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.TEMPLATE
  const SHARE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.SHARE
  const LOCAL_HANDOFF_NAMESPACE = PRESERVED_QUERY_NAMESPACES.LOCAL_HANDOFF
  const { flags } = useFeatureFlags()
  const draftStore = useWorkflowDraftStoreV2()
  draftStore.setAuthSubject(isCloud ? null : undefined)
  const tabState = useWorkflowTabState()
  const { isAuthInitialized, onUserLogout, onUserResolved } = useCurrentUser()
  const teamWorkspaceStore = useTeamWorkspaceStore()
  let stopWorkspaceReadinessWatcher: (() => void) | undefined
  let resolvedAuthSubject: string | null = null
  let authTransitionVersion = 0
  let authTransition = Promise.resolve()

  function stopPendingWorkspaceReadinessWatcher(): void {
    stopWorkspaceReadinessWatcher?.()
    stopWorkspaceReadinessWatcher = undefined
  }

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

  const lastSavedJsonByPath = ref<
    Record<
      string,
      {
        instanceId: string
        lastModified: number
        isModified: boolean
        json: string
      }
    >
  >({})
  const persistenceRetryAfterByPath = new Map<string, number>()
  let persistenceScope = draftStore.getScope()

  function clearPersistenceTracking(): void {
    lastSavedJsonByPath.value = {}
    persistenceRetryAfterByPath.clear()
  }

  watch(workflowPersistenceEnabled, (enabled) => {
    if (!enabled) {
      draftStore.reset()
      clearPersistenceTracking()
    }
  })

  const getCurrentWorkflowDraft = (
    activeWorkflow: ComfyWorkflow
  ): {
    state: ComfyWorkflowJSON
    json: string
  } | null => {
    const comfyApp = useApp()
    const hasPreview = activeWorkflow.changeTracker?.hasPreview
    const graphData = hasPreview
      ? activeWorkflow.activeState
      : (comfyApp.rootGraph.serialize() as unknown as ComfyWorkflowJSON)
    if (!graphData) return null
    const graph = activeWorkflow.graph
    const view =
      hasPreview
        ? activeWorkflow.changeTracker?.ds
        : graph && comfyApp.hasPendingCamera(graph)
          ? undefined
          : comfyApp.canvas.ds
    const state = withWorkflowViewState(graphData, view, {
      enabled: settingStore.get('Comfy.EnableWorkflowViewRestore')
    })
    return { state, json: JSON.stringify(state) }
  }

  const saveWorkflowDraft = (
    activeWorkflow: ComfyWorkflow,
    workflowJson: string,
    options: { evict: boolean }
  ): boolean => {
    try {
      return draftStore.saveDraft(
        activeWorkflow.path,
        workflowJson,
        {
          name: activeWorkflow.key,
          isTemporary: activeWorkflow.isTemporary,
          isModified: activeWorkflow.isModified
        },
        { ...options, minUpdatedAt: activeWorkflow.lastModified }
      )
    } catch (error) {
      console.error('Failed to persist workflow draft', error)
      return false
    }
  }

  const notifyDraftSaveFailure = () => {
    if (!draftStore.shouldNotifySaveFailure()) return
    showDraftSaveFailedToast()
  }

  const shouldRemoveSavedDraft = (
    activeWorkflow: ComfyWorkflow,
    draftState: ComfyWorkflowJSON
  ): boolean =>
    !activeWorkflow.isTemporary &&
    !activeWorkflow.isModified &&
    workflowViewStateEqual(
      activeWorkflow.initialState?.extra?.ds,
      draftState.extra?.ds
    )

  const persistCurrentWorkflow = ({ evict = true, force = false } = {}) => {
    if (draftStore.isPersistencePaused() || !workflowPersistenceEnabled.value)
      return
    if (isWorkflowStorageTransitioning()) return
    const activeWorkflow = workflowStore.activeWorkflow
    const tracker = activeWorkflow?.changeTracker
    if (!activeWorkflow || !tracker || !canCaptureCanvas(tracker)) return

    if (activeWorkflow.graph && activeWorkflow.graph !== useApp().rootGraph)
      return

    const scope = draftStore.getScope()
    if (scope !== persistenceScope) {
      clearPersistenceTracking()
      persistenceScope = scope
    }
    const workflowPath = activeWorkflow.path
    const retryAfter = persistenceRetryAfterByPath.get(workflowPath)
    if (!force && retryAfter !== undefined && Date.now() < retryAfter) return

    const draft = getCurrentWorkflowDraft(activeWorkflow)
    if (!draft) return
    const { state: draftState, json: workflowJson } = draft
    const saveKey = {
      instanceId: activeWorkflow.instanceId,
      lastModified: activeWorkflow.lastModified,
      isModified: activeWorkflow.isModified,
      json: workflowJson
    }
    const previous = lastSavedJsonByPath.value[workflowPath]

    // Include modification metadata and workflow identity in the skip key.
    // Explicit checkpoint flushes verify storage even after a previous save.
    if (
      !force &&
      previous?.instanceId === saveKey.instanceId &&
      previous.lastModified === saveKey.lastModified &&
      previous.isModified === saveKey.isModified &&
      previous.json === saveKey.json
    )
      return

    if (!saveWorkflowDraft(activeWorkflow, workflowJson, { evict })) {
      persistenceRetryAfterByPath.set(
        workflowPath,
        Date.now() + PERSIST_RETRY_BACKOFF_MS
      )
      notifyDraftSaveFailure()
      return
    }

    persistenceRetryAfterByPath.delete(workflowPath)
    draftStore.markSaveSucceeded()

    // Update session pointer
    tabState.setActivePath(workflowPath)

    if (shouldRemoveSavedDraft(activeWorkflow, draftState)) {
      if (!draftStore.removeDraft(workflowPath)) {
        notifyDraftSaveFailure()
        return
      }
    }
    lastSavedJsonByPath.value[workflowPath] = saveKey
  }

  const debouncedPersist = debounce(
    () => persistCurrentWorkflow(),
    PERSIST_DEBOUNCE_MS
  )

  function flushPendingPersistence() {
    debouncedPersist.cancel()
    persistCurrentWorkflow({ force: true })
  }

  function persistOnPageHide() {
    debouncedPersist.cancel()
    persistCurrentWorkflow({ evict: false, force: true })
  }

  const unregisterPersistence = registerWorkflowPersistence({
    flush: flushPendingPersistence,
    cancel: debouncedPersist.cancel,
    resumeAfterAbort: () => persistCurrentWorkflow({ force: true })
  })
  window.addEventListener('pagehide', persistOnPageHide)

  const isWorkspaceInitConcluded = () =>
    (teamWorkspaceStore.initState === 'ready' &&
      teamWorkspaceStore.activeWorkspaceId !== null) ||
    teamWorkspaceStore.initState === 'error'

  function resumePersistenceWhenWorkspaceIsReady(): void {
    stopPendingWorkspaceReadinessWatcher()
    if (isWorkspaceInitConcluded()) {
      releaseWorkflowStorageAuthFence()
      return
    }

    stopWorkspaceReadinessWatcher = whenever(
      isWorkspaceInitConcluded,
      () => {
        stopWorkspaceReadinessWatcher = undefined
        releaseWorkflowStorageAuthFence()
      },
      { once: true }
    )
  }

  async function waitForRestoreIdentity(): Promise<() => boolean> {
    if (isCloud && !isAuthInitialized.value)
      await until(isAuthInitialized).toBe(true)
    const restoreVersion = authTransitionVersion
    if (isCloud) await authTransition
    return () => restoreVersion === authTransitionVersion
  }

  async function waitForWorkspaceInitialization(): Promise<void> {
    if (isWorkspaceInitConcluded()) return
    await until(isWorkspaceInitConcluded).toBe(true)
  }

  onUserLogout(() => {
    if (!isCloud) return
    authTransitionVersion++
    resolvedAuthSubject = null
    fenceWorkflowStorageForAuthState()
    draftStore.reset()
    draftStore.setAuthSubject(null)
    clearPersistenceTracking()
    stopPendingWorkspaceReadinessWatcher()
    debouncedPersist.cancel()
    clearAllWorkspaceStorage()
  })
  onUserResolved((user) => {
    if (!isCloud) return
    void clearUnscopedDraftsAfterNewUserCheck()
    stopPendingWorkspaceReadinessWatcher()
    const previousSubject = resolvedAuthSubject
    resolvedAuthSubject = user.id

    if (!previousSubject || previousSubject === user.id) {
      draftStore.setAuthSubject(user.id)
      resumePersistenceWhenWorkspaceIsReady()
      return
    }

    const transitionVersion = ++authTransitionVersion

    const accountSwitchFence = prepareWorkflowLogoutTransition()
    debouncedPersist.cancel()
    draftStore.reset()
    clearPersistenceTracking()
    clearWorkflowRestoreState()
    authTransition = authTransition
      .then(async () => {
        try {
          if (transitionVersion !== authTransitionVersion) return
          workflowStore.activeWorkflow = null
          await useWorkflowService().loadBlankWorkflow()
          if (transitionVersion !== authTransitionVersion) return
          draftStore.setAuthSubject(user.id)
          await waitForWorkspaceInitialization()
          if (transitionVersion !== authTransitionVersion) return
          accountSwitchFence.release()
          releaseWorkflowStorageAuthFence()
          await runWithPersistencePaused(() =>
            draftStore.loadPersistedWorkflow({
              fallbackToLatestDraft: true,
              isCurrent: () => transitionVersion === authTransitionVersion
            })
          )
        } catch (error) {
          if (transitionVersion === authTransitionVersion) {
            draftStore.setAuthSubject(user.id)
            resumePersistenceWhenWorkspaceIsReady()
          }
          throw error
        } finally {
          accountSwitchFence.release()
        }
      })
      .catch((error: unknown) => {
        console.error('Error switching workflow persistence identity', error)
      })
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
      if (
        saved &&
        (await useWorkflowService().openWorkflow(saved, { isCurrent }))
      )
        return true
    }

    return await draftStore.loadPersistedWorkflow({
      fallbackToLatestDraft: true,
      isCurrent
    })
  }

  /**
   * The blank canvas startup opens for itself is not the user's work.
   * Discard stale drafts and pointers from older startup persistence.
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

  const hasLocalHandoffIntent = () =>
    flags.openOnCloudEnabled &&
    hasPreservedIntent(LOCAL_HANDOFF_NAMESPACE, LOCAL_HANDOFF_PARAM)

  const resolveStartupOutcome = async (
    workflowLinkPending = false
  ): Promise<StartupOutcome> => {
    if (settingStore.get('Comfy.TutorialCompleted')) {
      await useApp().loadGraphData()
      return 'restored'
    }

    await useWorkflowService().loadBlankWorkflow()
    await nextTick()
    discardStartupBlankDraft()
    return workflowLinkPending ||
      hasSharedWorkflowIntent() ||
      hasTemplateUrlIntent() ||
      hasLocalHandoffIntent()
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
      const linkedWorkflow =
        await linkedWorkflowUrlLoader.openLinkedWorkflowFromUrl()
      const workflowLinkPending = linkedWorkflow === 'pending'
      openedLinkedWorkflow = linkedWorkflow === 'opened'
      if (openedLinkedWorkflow) return 'restored' as const

      if (!workflowPersistenceEnabled.value) {
        return await resolveStartupOutcome(workflowLinkPending)
      }

      const isRestoreCurrent = await waitForRestoreIdentity()
      try {
        if (getRestorableTabState()) return 'restored' as const
        await workflowStore.loadWorkflows()
        if (!isRestoreCurrent()) return 'restored' as const
        const restored = await loadPreviousWorkflowFromStorage(isRestoreCurrent)
        if (!isRestoreCurrent()) return 'restored' as const
        return restored
          ? ('restored' as const)
          : await resolveStartupOutcome(workflowLinkPending)
      } catch (err) {
        console.error('Error loading previous workflow', err)
        return await resolveStartupOutcome(workflowLinkPending)
      }
    })

    const startupWorkflow = workflowStore.activeWorkflow
    if (
      workflowPersistenceEnabled.value &&
      startupWorkflow?.isTemporary &&
      startupWorkflow.isModified &&
      !draftStore.getDraft(startupWorkflow.path)
    ) {
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
    [
      () => workflowStore.activeWorkflow,
      () => workflowStore.activeWorkflow?.path
    ],
    ([activeWorkflow]) => {
      // beforeLoadNewGraph owns the outgoing synchronous draft save. A pending
      // graphChanged callback belongs to the old graph, so cancel it rather
      // than resolving it against the newly active workflow.
      debouncedPersist.cancel()
      if (
        !activeWorkflow ||
        draftStore.isPersistencePaused() ||
        isWorkflowStorageTransitioning() ||
        !workflowPersistenceEnabled.value
      )
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
    window.removeEventListener('pagehide', persistOnPageHide)
    unregisterPersistence()
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
  const restoreWorkflowTabsState = async () => {
    try {
      await restoreSavedTabs()
    } finally {
      workflowStore.markTabsRestored()
    }
  }

  const stampWithDraftTime = (
    restored: ComfyWorkflow,
    draftPath: string,
    draftUpdatedAt: number
  ) => {
    if (restored.path === draftPath) restored.lastModified = draftUpdatedAt
  }

  const restoreSavedTabs = async () =>
    await runWithPersistencePaused(async () => {
      if (!workflowPersistenceEnabled.value) {
        tabStateRestored = true
        return
      }

      const isRestoreCurrent = await waitForRestoreIdentity()

      try {
        await workflowStore.loadWorkflows()
      } catch (err) {
        console.error('Error loading workflows for tab restore', err)
        await resolveStartupOutcome()
        tabStateRestored = true
        return
      }

      const restorableTabState = isRestoreCurrent()
        ? getRestorableTabState()
        : null
      if (!restorableTabState) {
        tabStateRestored = true
        return
      }
      const { paths: storedWorkflows, activeIndex: storedActiveIndex } =
        restorableTabState

      for (const path of storedWorkflows) {
        if (!isRestoreCurrent()) return
        if (workflowStore.getWorkflowByPath(path)) continue
        const draft = draftStore.getDraft(path)
        if (!draft?.isTemporary) continue
        try {
          const parsed: unknown = JSON.parse(draft.data)
          const workflowData = await validateTemporaryDraftGraph(parsed)
          if (!isRestoreCurrent()) return
          if (workflowData) {
            const restored = workflowStore.createTemporary(
              draft.name,
              workflowData
            )
            stampWithDraftTime(restored, path, draft.updatedAt)
            continue
          }
        } catch (err) {
          console.warn('Failed to restore temporary workflow draft', err)
        }

        if (!isRestoreCurrent()) return
        draftStore.removeDraft(path)
        workflowStore.createTemporary(draft.name)
      }

      if (!isRestoreCurrent()) return
      workflowStore.openWorkflowsInBackground({
        left: storedWorkflows.slice(0, storedActiveIndex),
        right: storedWorkflows.slice(storedActiveIndex)
      })

      tabStateRestored = true
      if (openedLinkedWorkflow) return

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
