import { tryOnScopeDispose } from '@vueuse/core'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { clearWorkflowPersistenceStorage } from '@/platform/workflow/persistence/workflowStorage'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTemplateUrlLoader } from '@/platform/workflow/templates/composables/useTemplateUrlLoader'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { useCommandStore } from '@/stores/commandStore'
import { isCloud } from '@/platform/distribution/types'

export function useWorkflowPersistence() {
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()
  const route = useRoute()
  const router = useRouter()
  const templateUrlLoader = useTemplateUrlLoader()
  const { onUserLogout } = useCurrentUser()
  const TEMPLATE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.TEMPLATE

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

  const persistCurrentWorkflow = () => {
    if (!workflowPersistenceEnabled.value) return
    const workflow = JSON.stringify(comfyApp.graph.serialize())

    try {
      localStorage.setItem('workflow', workflow)
      if (api.clientId) {
        sessionStorage.setItem(`workflow:${api.clientId}`, workflow)
      }
    } catch (error) {
      // Only log our own keys and aggregate stats
      const ourKeys = Object.keys(sessionStorage).filter(
        (key) => key.startsWith('workflow:') || key === 'workflow'
      )
      console.error('QuotaExceededError details:', {
        workflowSizeKB: Math.round(workflow.length / 1024),
        totalStorageItems: Object.keys(sessionStorage).length,
        ourWorkflowKeys: ourKeys.length,
        ourWorkflowSizes: ourKeys.map((key) => ({
          key,
          sizeKB: Math.round(sessionStorage[key].length / 1024)
        })),
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  const loadWorkflowFromStorage = async (
    json: string | null,
    workflowName: string | null
  ) => {
    if (!json) return false
    const workflow = JSON.parse(json)
    await comfyApp.loadGraphData(workflow, true, true, workflowName)
    return true
  }

  const loadPreviousWorkflowFromStorage = async () => {
    const workflowName = getStorageValue('Comfy.PreviousWorkflow')
    const clientId = api.initialClientId ?? api.clientId

    // Try loading from session storage first
    if (clientId) {
      const sessionWorkflow = sessionStorage.getItem(`workflow:${clientId}`)
      if (await loadWorkflowFromStorage(sessionWorkflow, workflowName)) {
        return true
      }
    }

    // Fall back to local storage
    const localWorkflow = localStorage.getItem('workflow')
    return await loadWorkflowFromStorage(localWorkflow, workflowName)
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

  const initializeWorkflow = async () => {
    if (!workflowPersistenceEnabled.value) return

    try {
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
    const query = await ensureTemplateQueryFromIntent()
    const hasTemplateUrl = query.template && typeof query.template === 'string'

    if (hasTemplateUrl) {
      await templateUrlLoader.loadTemplateFromUrl()
    }
  }

  // Setup watchers
  watch(
    () => workflowStore.activeWorkflow?.key,
    (activeWorkflowKey) => {
      if (!activeWorkflowKey) return
      setStorageValue('Comfy.PreviousWorkflow', activeWorkflowKey)
      // When the activeWorkflow changes, the graph has already been loaded.
      // Saving the current state of the graph to the localStorage.
      persistCurrentWorkflow()
    }
  )
  api.addEventListener('graphChanged', persistCurrentWorkflow)

  // Clean up event listener when component unmounts
  tryOnScopeDispose(() => {
    api.removeEventListener('graphChanged', persistCurrentWorkflow)
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
        .filter((workflow) => workflow?.isPersisted)
        .map((workflow) => workflow.path)
      const activeIndex = openWorkflows.value.findIndex(
        (workflow) => workflow.path === activeWorkflow.value?.path
      )

      return { paths, activeIndex }
    }
  )

  // Get storage values before setting watchers
  const storedWorkflows = JSON.parse(
    getStorageValue('Comfy.OpenWorkflowsPaths') || '[]'
  )
  const storedActiveIndex = JSON.parse(
    getStorageValue('Comfy.ActiveWorkflowIndex') || '-1'
  )

  watch(restoreState, ({ paths, activeIndex }) => {
    if (workflowPersistenceEnabled.value) {
      setStorageValue('Comfy.OpenWorkflowsPaths', JSON.stringify(paths))
      setStorageValue('Comfy.ActiveWorkflowIndex', JSON.stringify(activeIndex))
    }
  })

  onUserLogout(() => {
    if (isCloud) clearWorkflowPersistenceStorage()
  })

  const restoreWorkflowTabsState = () => {
    if (!workflowPersistenceEnabled.value) return
    const isRestorable = storedWorkflows?.length > 0 && storedActiveIndex >= 0
    if (isRestorable) {
      workflowStore.openWorkflowsInBackground({
        left: storedWorkflows.slice(0, storedActiveIndex),
        right: storedWorkflows.slice(storedActiveIndex)
      })
    }
  }

  return {
    initializeWorkflow,
    loadTemplateFromUrlIfPresent,
    restoreWorkflowTabsState
  }
}
