/**
 * V2 Workflow Persistence Composable
 *
 * Key changes from V1:
 * - Uses V2 draft store with per-draft keys
 * - Uses tab state composable for session pointers
 * - Adds 512ms debounce on graph change persistence
 */

import { debounce } from 'es-toolkit'
import { useToast } from '@/components/ui/toast/toastStore'
import { tryOnScopeDispose, until, whenever } from '@vueuse/core'
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
  clearAllWorkspaceStorage,
  clearWorkflowRestoreState,
  completeWorkflowLogoutTransition,
  prepareWorkflowLogoutTransition,
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
  draftStore.setAuthSubject(isCloud ? null : undefined)
  const tabState = useWorkflowTabState()
  const toast = useToast()
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

  function flushPendingPersistence() {
    debouncedPersist.flush()
  }

  const unregisterPersistenceFlush = registerWorkflowPersistenceFlush(
    flushPendingPersistence
  )
  window.addEventListener('pagehide', flushPendingPersistence)

  const isWorkspaceInitConcluded = () =>
    (teamWorkspaceStore.initState === 'ready' &&
      teamWorkspaceStore.activeWorkspaceId !== null) ||
    teamWorkspaceStore.initState === 'error'

  function resumePersistenceWhenWorkspaceIsReady(): void {
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
    draftStore.setAuthSubject(null)
    stopPendingWorkspaceReadinessWatcher()
    debouncedPersist.cancel()
    prepareWorkflowLogoutTransition()
    clearAllWorkspaceStorage()
  })
  onUserResolved((user) => {
    if (!isCloud) return
    stopPendingWorkspaceReadinessWatcher()
    const previousSubject = resolvedAuthSubject
    resolvedAuthSubject = user.id

    if (!previousSubject || previousSubject === user.id) {
      draftStore.setAuthSubject(user.id)
      resumePersistenceWhenWorkspaceIsReady()
      return
    }

    const transitionVersion = ++authTransitionVersion

    debouncedPersist.cancel()
    prepareWorkflowLogoutTransition()
    clearWorkflowRestoreState()
    authTransition = authTransition
      .then(async () => {
        if (transitionVersion !== authTransitionVersion) return
        workflowStore.activeWorkflow = null
        try {
          await useWorkflowService().loadBlankWorkflow()
          if (transitionVersion !== authTransitionVersion) return
          draftStore.setAuthSubject(user.id)
          await waitForWorkspaceInitialization()
          if (transitionVersion !== authTransitionVersion) return
          await draftStore.loadPersistedWorkflow({
            fallbackToLatestDraft: true
          })
        } finally {
          if (transitionVersion === authTransitionVersion) {
            draftStore.setAuthSubject(user.id)
            completeWorkflowLogoutTransition()
          }
        }
      })
      .catch((error: unknown) => {
        console.error('Error switching workflow persistence identity', error)
      })
  })

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
        await useWorkflowService().openWorkflow(saved, { isCurrent })
        return true
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
      persistCurrentWorkflow()
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
  const restoreWorkflowTabsState = async () => {
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
