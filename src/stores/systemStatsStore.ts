import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { SystemStats } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { isElectron } from '@/utils/envUtil'

export const useSystemStatsStore = defineStore('systemStats', () => {
  const systemStats = ref<SystemStats | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSystemStats() {
    isLoading.value = true
    error.value = null

    try {
      systemStats.value = await api.getSystemStats()
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : 'An error occurred while fetching system stats'
      console.error('Error fetching system stats:', err)
    } finally {
      isLoading.value = false
    }
  }

  function getFormFactor(): string {
    if (!systemStats.value?.system?.os) {
      return 'other'
    }

    const os = systemStats.value.system.os.toLowerCase()
    const isDesktop = isElectron()

    if (isDesktop) {
      if (os.includes('windows')) {
        return 'desktop-windows'
      }
      if (os.includes('darwin') || os.includes('mac')) {
        return 'desktop-mac'
      }
    } else {
      // Git/source installation
      if (os.includes('windows')) {
        return 'git-windows'
      }
      if (os.includes('darwin') || os.includes('mac')) {
        return 'git-mac'
      }
      if (os.includes('linux')) {
        return 'git-linux'
      }
    }

    return 'other'
  }

  return {
    systemStats,
    isLoading,
    error,
    fetchSystemStats,
    getFormFactor
  }
})
