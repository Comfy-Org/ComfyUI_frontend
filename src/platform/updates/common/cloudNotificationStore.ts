import { until } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { isElectron } from '@/utils/envUtil'

export const useCloudNotificationStore = defineStore(
  'cloudNotification',
  () => {
    const settingStore = useSettingStore()
    const systemStatsStore = useSystemStatsStore()

    const isReady = ref(false)
    const hasShownThisSession = ref(false)

    async function initialize() {
      if (isReady.value) return
      await until(settingStore.isInitialized)
      await until(systemStatsStore.isInitialized)
      isReady.value = true
    }

    const isEligiblePlatform = computed(() => {
      if (!isReady.value) return false
      if (!isElectron()) return false

      const osString =
        systemStatsStore.systemStats?.system?.os?.toLowerCase() ?? ''
      const platformString =
        typeof navigator === 'undefined' ? '' : navigator.platform.toLowerCase()

      return (
        osString.includes('darwin') ||
        osString.includes('mac') ||
        platformString.includes('mac')
      )
    })

    const hasSeenNotification = computed(() => {
      if (!isReady.value) return true
      return !!settingStore.get('Comfy.Desktop.CloudNotificationShown')
    })

    const shouldShowNotification = computed(() => {
      if (!isReady.value) return false
      if (!isEligiblePlatform.value) return false

      return !hasSeenNotification.value && !hasShownThisSession.value
    })

    function markSessionShown() {
      hasShownThisSession.value = true
    }

    async function persistNotificationShown() {
      await settingStore.set('Comfy.Desktop.CloudNotificationShown', true)
    }

    return {
      initialize,
      shouldShowNotification,
      markSessionShown,
      persistNotificationShown
    }
  }
)
