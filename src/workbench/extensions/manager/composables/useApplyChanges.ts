import { createSharedComposable, useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

export const useApplyChanges = createSharedComposable(() => {
  const comfyManagerStore = useComfyManagerStore()
  const settingStore = useSettingStore()
  const { runFullConflictAnalysis } = useConflictDetection()

  const isRestarting = ref(false)
  const isRestartCompleted = ref(false)

  async function applyChanges(onClose?: () => void) {
    const originalToastSetting = settingStore.get(
      'Comfy.Toast.DisableReconnectingToast'
    )
    const onReconnect = async () => {
      try {
        comfyManagerStore.setStale()
        await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
        await useWorkflowService().reloadCurrentWorkflow()
        void runFullConflictAnalysis()
      } finally {
        await settingStore.set(
          'Comfy.Toast.DisableReconnectingToast',
          originalToastSetting
        )
        isRestarting.value = false
        isRestartCompleted.value = true

        setTimeout(() => {
          onClose?.()
        }, 3000)
      }
    }

    const stopReconnectListener = useEventListener(
      api,
      'reconnected',
      onReconnect,
      { once: true }
    )

    try {
      await settingStore.set('Comfy.Toast.DisableReconnectingToast', true)
      isRestarting.value = true
      await useComfyManagerService().rebootComfyUI()
    } catch (error) {
      stopReconnectListener()
      await settingStore.set(
        'Comfy.Toast.DisableReconnectingToast',
        originalToastSetting
      )
      isRestarting.value = false
      isRestartCompleted.value = false
      onClose?.()
      throw error
    }
  }

  return { isRestarting, isRestartCompleted, applyChanges }
})
