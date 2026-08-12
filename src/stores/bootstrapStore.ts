import { until, useAsyncState } from '@vueuse/core'
import axios from 'axios'
import { defineStore, storeToRefs } from 'pinia'

import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { CustomNodesI18n } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'

/**
 * Backends that vendor no custom-node locale files do not implement
 * `/api/i18n`, so a 404 means "no custom-node translations", not a failure.
 */
async function fetchCustomNodesI18n(): Promise<CustomNodesI18n | undefined> {
  try {
    return await api.getCustomNodesI18n()
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return
    throw error
  }
}

export const useBootstrapStore = defineStore('bootstrap', () => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()

  const {
    isReady: isI18nReady,
    error: i18nError,
    execute: loadI18n
  } = useAsyncState(
    async () => {
      const { mergeCustomNodesI18n } = await import('@/i18n')
      const i18nData = await fetchCustomNodesI18n()
      if (i18nData) mergeCustomNodesI18n(i18nData)
    },
    undefined,
    { immediate: false }
  )

  let storesLoaded = false

  function loadAuthenticatedStores() {
    if (storesLoaded) return
    storesLoaded = true
    void settingStore.load()
    void workflowStore.loadWorkflows()
  }

  async function startStoreBootstrap() {
    if (isCloud) {
      const { isInitialized, isAuthenticated } = storeToRefs(useAuthStore())
      await until(isInitialized).toBe(true)
      await until(isAuthenticated).toBe(true)
    }

    const userStore = useUserStore()
    await userStore.initialize()

    const { needsLogin } = storeToRefs(userStore)
    await until(needsLogin).toBe(false)

    void loadI18n()
    loadAuthenticatedStores()
  }

  return {
    isI18nReady,
    i18nError,
    startStoreBootstrap
  }
})
