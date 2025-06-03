import { computed, watch } from 'vue'

import { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'

export function useWorkflowPersistence() {
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()

  const workflowPersistenceEnabled = computed(() =>
    settingStore.get('Comfy.Workflow.Persist')
  )

  const persistCurrentWorkflows = () => {
    if (!workflowPersistenceEnabled.value) return
    const workflows: Record<string, ComfyWorkflowJSON> = {}
    for (const workflow of workflowStore.workflows) {
      if (workflow.isLoaded) {
        workflows[workflow.path] = workflow.activeState as ComfyWorkflowJSON
      }
    }
    const serialized = JSON.stringify(workflows)
    localStorage.setItem('workflows', serialized)
    if (api.clientId) {
      sessionStorage.setItem(`workflows:${api.clientId}`, serialized)
    }
  }

  const loadWorkflowsFromStorage = async (
    json: string | null,
    activeWorkflowName: string | null
  ) => {
    if (!json) return false
    const workflows = JSON.parse(json) as Record<string, ComfyWorkflowJSON>
    if (Object.values(workflows).length === 0) return false

    // Find the path of the active workflow if it exists
    const activeWorkflowPath = activeWorkflowName
      ? Object.keys(workflows).find(
          (path) =>
            path.substring(ComfyWorkflow.basePath.length) === activeWorkflowName
        )
      : null

    let isFirstWorkflow = true

    // Process all workflows in a single pass
    for (const [path, workflow] of Object.entries(workflows)) {
      // If this is the active workflow, load it as active
      const basename = path.substring(ComfyWorkflow.basePath.length)
      if (
        path === activeWorkflowPath ||
        (activeWorkflowPath === null && isFirstWorkflow)
      ) {
        await comfyApp.loadGraphData(workflow, true, true, basename)
        isFirstWorkflow = false
      }
      // Otherwise, load in background
      else {
        const tempWorkflow = workflowStore.createTemporary(basename, workflow)
        await tempWorkflow.load()
        workflowStore.openWorkflowsInBackground({ right: [tempWorkflow.path] })
      }
    }
    return true
  }

  const loadPreviousWorkflowsFromStorage = async () => {
    const activeWorkflowName = getStorageValue('Comfy.PreviousWorkflow')
    const clientId = api.initialClientId ?? api.clientId

    // Try loading from session storage first
    if (clientId) {
      const workflows = sessionStorage.getItem(`workflows:${clientId}`)
      if (await loadWorkflowsFromStorage(workflows, activeWorkflowName)) {
        return true
      }
    }

    // Fall back to local storage
    const workflows = localStorage.getItem('workflows')
    return await loadWorkflowsFromStorage(workflows, activeWorkflowName)
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
      const restored = await loadPreviousWorkflowsFromStorage()
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
      persistCurrentWorkflows()
    }
  )
  api.addEventListener('graphChanged', persistCurrentWorkflows)

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
