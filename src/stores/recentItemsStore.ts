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
      .filter((a) => typeof a.created === 'number')
      .sort((a, b) => b.created - a.created)
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

  const recentlyUsedModels = computed(() => {
    if (!modelLog.value) return []

    return Object.entries(modelLog.value.activeState)
      .map(([key, lastUsed]) => ({ key, last_used: lastUsed }))
      .filter((a) => typeof a.last_used === 'number')
      .sort((a, b) => b.last_used - a.last_used)
      .slice(0, maxRecentItemCount.value)
      .map((entry) => modelStore.models.find((m) => m.key === entry.key))
      .filter((a) => !!a) as ComfyModelDef[]
  })

  const logModelUsage = async (model: ComfyModelDef) => {
    if (!modelLog.value) return
    modelLog.value.updateModelUsage(model.key)
    await modelLog.value.save()
  }

  const loadRecentModels = async () => {
    if (!modelLog.value) {
      modelLog.value = await ComfyModelLog.fromAPI()
    }
  }

  return {
    recentlyUsedWorkflows,
    recentlyUsedModels,
    recentlyAddedWorkflows,
    recentlyAddedModels,
    logModelUsage,
    loadRecentModels
  }
})
