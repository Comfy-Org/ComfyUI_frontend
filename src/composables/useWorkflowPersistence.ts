import { computed, watch } from 'vue'

import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'

export function useWorkflowPersistence() {
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()

  const workflowPersistenceEnabled = computed(() =>
    settingStore.get('Comfy.Workflow.Persist')
  )

  const persistCurrentWorkflow = () => {
    if (!workflowPersistenceEnabled.value) return
    const workflow = JSON.stringify(comfyApp.graph.serialize())
    localStorage.setItem('workflow', workflow)
    if (api.clientId) {
      sessionStorage.setItem(`workflow:${api.clientId}`, workflow)
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

  const restorePreviousWorkflow = async () => {
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

  // Restore workflow tabs states
  const openWorkflows = computed(() => workflowStore.openWorkflows)
  const activeWorkflow = computed(() => workflowStore.activeWorkflow)
  const restoreState = computed<{ paths: string[]; activeIndex: number }>(
    () => {
      if (!openWorkflows.value || !activeWorkflow.value) {
        return { paths: [], activeIndex: -1 }
      }

      const paths = openWorkflows.value
        .filter((workflow) => workflow?.isPersisted && !workflow.isModified)
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
    restorePreviousWorkflow,
    restoreWorkflowTabsState
  }
}
