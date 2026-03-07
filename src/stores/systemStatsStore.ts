import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'

import { isCloud, isDesktop } from '@/platform/distribution/types'
import type { SystemStats } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

export const useSystemStatsStore = defineStore('systemStats', () => {
  const fetchSystemStatsData = () => api.getSystemStats()

  const {
    state: systemStats,
    isLoading,
    error,
    isReady: isInitialized,
    execute: refetchSystemStats
  } = useAsyncState<SystemStats | null>(
    fetchSystemStatsData,
    null, // initial value
    {
      immediate: true
    }
  )

  function getFormFactor(): string {
    if (isCloud) {
      return 'cloud'
    }

    if (!systemStats.value?.system?.os) {
      return 'other'
    }

    const os = systemStats.value.system.os.toLowerCase()

    const prefix = isDesktop ? 'desktop' : 'git'
    if (os.includes('windows')) return `${prefix}-windows`
    if (os.includes('darwin') || os.includes('mac')) return `${prefix}-mac`
    if (os.includes('linux')) return `${prefix}-linux`

    return 'other'
  }

  return {
    systemStats,
    isLoading,
    error,
    isInitialized,
    refetchSystemStats,
    getFormFactor
  }
})
