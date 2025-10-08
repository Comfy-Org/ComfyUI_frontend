import { tryOnScopeDispose } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import {
  clearDraft,
  createDraftSnapshot,
  readDraft,
  writeDraft
} from '@/platform/workflow/persistence/utils/workflowDraftStore'
import { loadPersistedWorkflow } from '@/platform/workflow/persistence/utils/workflowPersistenceLoader'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { useCommandStore } from '@/stores/commandStore'

export function useWorkflowPersistence() {
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()

  const workflowPersistenceEnabled = computed(() =>
    settingStore.get('Comfy.Workflow.Persist')
  )

  const persistCurrentWorkflow = () => {
    if (!workflowPersistenceEnabled.value) return
    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow) return

    const graphData = comfyApp.graph.serialize()
    const workflowJson = JSON.stringify(graphData)
    localStorage.setItem('workflow', workflowJson)
    if (api.clientId) {
      sessionStorage.setItem(`workflow:${api.clientId}`, workflowJson)
    }

    if (!activeWorkflow.isTemporary && !activeWorkflow.isModified) {
      clearDraft(activeWorkflow.path)
      return
    }

    writeDraft(
      activeWorkflow.path,
      createDraftSnapshot(
        graphData,
        activeWorkflow.key,
        activeWorkflow.isTemporary
      )
    )
  }

  const loadPreviousWorkflowFromStorage = async () => {
    const workflowName = getStorageValue('Comfy.PreviousWorkflow')
    const preferredPath = workflowName
      ? `${ComfyWorkflow.basePath}${workflowName}`
      : null

    return await loadPersistedWorkflow({
      workflowName,
      preferredPath,
      fallbackToLatestDraft: !workflowName
    })
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
        .map((workflow) => workflow?.path)
        .filter(
          (path): path is string =>
            typeof path === 'string' && path.startsWith(ComfyWorkflow.basePath)
        )
      const activeIndex = paths.indexOf(activeWorkflow.value.path)

      return { paths, activeIndex }
    }
  )

  // Get storage values before setting watchers
  const storedWorkflows = JSON.parse(
    getStorageValue('Comfy.OpenWorkflowsPaths') || '[]'
  ) as string[]
  const storedActiveIndex = JSON.parse(
    getStorageValue('Comfy.ActiveWorkflowIndex') || '-1'
  ) as number

  watch(restoreState, ({ paths, activeIndex }) => {
    if (workflowPersistenceEnabled.value) {
      setStorageValue('Comfy.OpenWorkflowsPaths', JSON.stringify(paths))
      setStorageValue('Comfy.ActiveWorkflowIndex', JSON.stringify(activeIndex))
    }
  })

  const restoreWorkflowTabsState = () => {
    if (!workflowPersistenceEnabled.value) return
    const isRestorable = storedWorkflows?.length > 0 && storedActiveIndex >= 0
    if (!isRestorable) return

    storedWorkflows.forEach((path: string) => {
      if (workflowStore.getWorkflowByPath(path)) return
      const draft = readDraft(path)
      if (!draft?.isTemporary) return
      workflowStore.createTemporary(draft.name)
    })

    workflowStore.openWorkflowsInBackground({
      left: storedWorkflows.slice(0, storedActiveIndex),
      right: storedWorkflows.slice(storedActiveIndex)
    })
  }

  return {
    restorePreviousWorkflow,
    restoreWorkflowTabsState
  }
}
