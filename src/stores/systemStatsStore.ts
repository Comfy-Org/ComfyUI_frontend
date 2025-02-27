import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { SystemStats } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

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

  return {
    systemStats,
    isLoading,
    error,
    fetchSystemStats
  }
})
