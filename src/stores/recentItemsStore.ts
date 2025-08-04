import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ComfyModelLog } from '@/services/modelLogService'

import { ComfyModelDef, useModelStore } from './modelStore'
import { useSettingStore } from './settingStore'
import { useWorkflowStore } from './workflowStore'

export const useRecentItemsStore = defineStore('recentItems', () => {
  const workflowStore = useWorkflowStore()
  const modelStore = useModelStore()
  const settings = useSettingStore()
  const modelLog = ref<ComfyModelLog | null>(null)

  // Loading states
  const isLoadingModelLog = ref(false)
  const isModelLogLoaded = computed(
    () => !!modelLog.value && !isLoadingModelLog.value
  )
  const areModelsReady = computed(
    () => modelStore.models.length > 0 && isModelLogLoaded.value
  )

  // Computed properties for "Recently Added" based on file timestamps
  const maxRecentItemCount = computed(() =>
    settings.get('Comfy.Sidebar.RecentItems.MaxCount')
  )

  const recentlyAddedWorkflows = computed(() => {
    const workflows = workflowStore.workflows
    if (workflows.length === 0) {
      return []
    }

    // Sort by dateCreated and pick the first {maxRecentItemCount}
    return workflows
      .filter((a) => a.created && typeof a.created === 'number')
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
      .slice(0, maxRecentItemCount.value)
  })

  const recentlyAddedModels = computed(() => {
    const models = modelStore.models
    if (models.length === 0) {
      return []
    }
    // Sort by dateCreated and pick the first {maxRecentItemCount}
    return models
      .filter((a) => typeof a.date_created === 'number')
      .sort((a, b) => b.date_created - a.date_created)
      .slice(0, maxRecentItemCount.value)
  })

  const recentlyUsedWorkflows = computed(() => {
    return workflowStore.workflows
      .filter((a) => typeof a.lastModified === 'number')
      .sort((a, b) => {
        return (b.lastModified ?? 0) - (a.lastModified ?? 0)
      })
      .slice(0, maxRecentItemCount.value)
  })

  const sortedModelEntries = computed(() => {
    if (!modelLog.value) return []

    return Object.entries(modelLog.value.activeState)
      .map(([key, lastUsed]) => ({ key, last_used: lastUsed }))
      .filter((a) => typeof a.last_used === 'number')
      .sort((a, b) => b.last_used - a.last_used)
  })

  const modelLookupMap = computed(() => {
    return new Map(modelStore.models.map((model) => [model.key, model]))
  })

  const recentlyUsedModels = computed(() => {
    // Return empty array if data isn't ready to prevent race conditions
    if (!areModelsReady.value) {
      return []
    }

    return sortedModelEntries.value
      .slice(0, maxRecentItemCount.value)
      .map((entry) => modelLookupMap.value.get(entry.key))
      .filter((model): model is ComfyModelDef => !!model)
  })

  const logModelUsage = async (model: ComfyModelDef) => {
    if (!modelLog.value) return
    modelLog.value.updateModelUsage(model.key)
    await modelLog.value.save()
  }

  const loadRecentModels = async () => {
    if (!modelLog.value && !isLoadingModelLog.value) {
      isLoadingModelLog.value = true
      try {
        modelLog.value = await ComfyModelLog.fromAPI()
      } finally {
        isLoadingModelLog.value = false
      }
    }
  }

  return {
    recentlyUsedWorkflows,
    recentlyUsedModels,
    recentlyAddedWorkflows,
    recentlyAddedModels,
    logModelUsage,
    loadRecentModels,
    // Loading states for components to show loading indicators
    isLoadingModelLog,
    isModelLogLoaded,
    areModelsReady
  }
})
