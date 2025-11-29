import { ref, computed } from 'vue'

import { defineStore } from 'pinia'

import { comfyApi, type SystemStats } from '@/services/comfyApi'

export const useComfyStore = defineStore('comfy', () => {
  // State
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const systemStats = ref<SystemStats | null>(null)
  const error = ref<string | null>(null)

  // Getters
  const connectionStatus = computed(() => {
    if (isConnecting.value) return 'connecting'
    if (isConnected.value) return 'connected'
    return 'disconnected'
  })

  // Actions
  async function connect() {
    if (isConnected.value || isConnecting.value) return

    isConnecting.value = true
    error.value = null

    try {
      const stats = await comfyApi.getSystemStats()
      systemStats.value = stats
      isConnected.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to connect'
      isConnected.value = false
    } finally {
      isConnecting.value = false
    }
  }

  function disconnect() {
    isConnected.value = false
    systemStats.value = null
  }

  return {
    // State
    isConnected,
    isConnecting,
    systemStats,
    error,
    // Getters
    connectionStatus,
    // Actions
    connect,
    disconnect
  }
})
