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
import { useDesktopLayout } from '@/composables/useDesktopLayout'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useNewUserService } from '@/services/useNewUserService'

import { PERSIST_DEBOUNCE_MS } from '../base/draftTypes'
import { clearAllV2Storage } from '../base/storageIO'
import { migrateV1toV2 } from '../migration/migrateV1toV2'
import type { OnboardingCandidateDeps } from '../onboardingEntryStore'
import {
  isOnboardingCandidate,
  useOnboardingEntryStore
} from '../onboardingEntryStore'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowTabState } from './useWorkflowTabState'
import { useSharedWorkflowUrlLoader } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'

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
  const entryStore = useOnboardingEntryStore()
  const onboardingDeps: OnboardingCandidateDeps = {
    subscription: useSubscription(),
    newUserService: useNewUserService(),
    featureFlags: useFeatureFlags(),
    desktop: useDesktopLayout()
  }
  const { onUserLogout } = useCurrentUser()

  // Run migration on module load, passing clientId for tab state migration
  migrateV1toV2(undefined, api.clientId ?? api.initialClientId ?? undefined)

  // Clear workflow persistence storage when user signs out (cloud only)
  onUserLogout(() => {
    if (isCloud) {
      clearAllV2Storage()
    }
  })

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

  const loadDefaultWorkflow = async () => {
    if (settingStore.get('Comfy.TutorialCompleted')) {
      await comfyApp.loadGraphData()
      return
    }

    await settingStore.set('Comfy.TutorialCompleted', true)
    await useWorkflowService().loadBlankWorkflow()
    if (hasSharedWorkflowIntent() || hasTemplateUrlIntent()) return

    if (isOnboardingCandidate(onboardingDeps)) {
      entryStore.showGettingStarted()
    } else {
      await useCommandStore().execute('Comfy.BrowseTemplates')
    }
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

  const initializeWorkflow = async () => {
    if (!workflowPersistenceEnabled.value) {
      await loadDefaultWorkflow()
      return
    }

    try {
      if (getRestorableTabState()) {
        // GraphCanvas calls restoreWorkflowTabsState next; skip the single-workflow
        // fallback here so the saved tab order and active index drive startup.
        return
      }

      await workflowStore.loadWorkflows()
      const restored = await loadPreviousWorkflowFromStorage()
      if (!restored) {
        await loadDefaultWorkflow()
      }
    } catch (err) {
      console.error('Error loading previous workflow', err)
      await loadDefaultWorkflow()
    }
  }

  const loadTemplateFromUrlIfPresent = async () => {
    hydratePreservedQuery(TEMPLATE_NAMESPACE)
    const query = mergePreservedQueryIntoQuery(TEMPLATE_NAMESPACE, route.query)
    if (query) await router.replace({ query })

    return templateUrlLoader.loadTemplateFromUrl()
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
      await loadDefaultWorkflow()
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
