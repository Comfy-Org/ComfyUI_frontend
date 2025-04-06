import { computed, onUnmounted, watch } from 'vue'

import { api } from '@/scripts/api'
import { useWorkflowService } from '@/services/workflowService'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'

export function useWorkflowAutoSave() {
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()
  const workflowService = useWorkflowService()

  // Use computed refs to cache autosave settings
  const autoSaveSetting = computed(() =>
    settingStore.get('Comfy.Workflow.AutoSave')
  )
  const autoSaveDelay = computed(() =>
    settingStore.get('Comfy.Workflow.AutoSaveDelay')
  )

  let autoSaveTimeout: NodeJS.Timeout | null = null
  let isSaving = false

  const scheduleAutoSave = () => {
    // Clear any existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
      autoSaveTimeout = null
    }

    // If autosave is enabled and set to "after delay" and not currently saving
    if (autoSaveSetting.value === 'after delay' && !isSaving) {
      const delay = autoSaveDelay.value
      autoSaveTimeout = setTimeout(async () => {
        const activeWorkflow = workflowStore.activeWorkflow
        if (activeWorkflow?.isModified) {
          try {
            isSaving = true
            await workflowService.saveWorkflow(activeWorkflow)
          } catch (err) {
            console.error('Auto save failed:', err)
          } finally {
            isSaving = false
          }
        }
      }, delay)
    }
  }

  // Watch for autosave setting changes
  watch(
    autoSaveSetting,
    (newSetting) => {
      // Clear any existing timeout when settings change
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
        autoSaveTimeout = null
      }

      // If there's an active modified workflow and autosave is enabled, schedule a save
      if (
        newSetting === 'after delay' &&
        workflowStore.activeWorkflow?.isModified
      ) {
        scheduleAutoSave()
      }
    },
    { immediate: true }
  )

  // Listen for graph changes and schedule autosave when they occur
  const onGraphChanged = () => {
    scheduleAutoSave()
  }

  api.addEventListener('graphChanged', onGraphChanged)

  onUnmounted(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
      autoSaveTimeout = null
    }
    api.removeEventListener('graphChanged', onGraphChanged)
  })
}

useWorkflowAutoSave()
