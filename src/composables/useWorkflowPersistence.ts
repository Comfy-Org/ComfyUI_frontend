import { computed, watch, watchEffect } from 'vue'
import { debounce } from 'lodash'

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

  const persistCurrentWorkflow = () => {
    const workflow = JSON.stringify(comfyApp.serializeGraph())
    localStorage.setItem('workflow', workflow)
    if (api.clientId) {
      sessionStorage.setItem(`workflow:${api.clientId}`, workflow)
    }
  }

  // Create a debounced version of persistCurrentWorkflow to avoid excessive serialization
  const debouncedPersistCurrentWorkflow = debounce(persistCurrentWorkflow, 1000)

  // Setup watchers with debounced persistence
  watchEffect(() => {
    if (workflowStore.activeWorkflow) {
      const workflow = workflowStore.activeWorkflow
      setStorageValue('Comfy.PreviousWorkflow', workflow.key)
      // When the activeWorkflow changes, use debounced persistence here as well
      // to avoid constant serialization on pointer move events
      debouncedPersistCurrentWorkflow()
    }
  })
  
  // Use the same debounced version for the event listener
  api.addEventListener('graphChanged', debouncedPersistCurrentWorkflow)

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
    setStorageValue('Comfy.OpenWorkflowsPaths', JSON.stringify(paths))
    setStorageValue('Comfy.ActiveWorkflowIndex', JSON.stringify(activeIndex))
  })

  const restoreWorkflowTabsState = () => {
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
