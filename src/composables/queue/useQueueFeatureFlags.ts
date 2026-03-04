import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

export function useQueueFeatureFlags() {
  const settingStore = useSettingStore()

  const isQueuePanelV2Enabled = computed(() =>
    settingStore.get('Comfy.Queue.QPOV2')
  )
  const isRunProgressBarEnabled = computed(
    () => settingStore.get('Comfy.Queue.ShowRunProgressBar') !== false
  )

  return {
    isQueuePanelV2Enabled,
    isRunProgressBarEnabled
  }
}
