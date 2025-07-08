import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useModelStore } from './modelStore'
import { useSettingStore } from './settingStore'
import { useWorkflowStore } from './workflowStore'

export const useRecentItemsStore = defineStore('recentItems', () => {
  const workflowStore = useWorkflowStore()
  const modelStore = useModelStore()
  const settings = useSettingStore()

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
    return modelStore.models
      .filter((a) => typeof a.last_modified === 'number')
      .sort((a, b) => {
        return (b.last_modified ?? 0) - (a.last_modified ?? 0)
      })
      .slice(0, maxRecentItemCount.value)
  })

  return {
    recentlyUsedWorkflows,
    recentlyUsedModels,
    recentlyAddedWorkflows,
    recentlyAddedModels
  }
})
