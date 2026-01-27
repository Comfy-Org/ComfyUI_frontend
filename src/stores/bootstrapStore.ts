import { until, useAsyncState } from '@vueuse/core'
import { defineStore, storeToRefs } from 'pinia'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useUserStore } from '@/stores/userStore'
import { isCloud } from '@/platform/distribution/types'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

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
      const i18nData = await api.getCustomNodesI18n()
      mergeCustomNodesI18n(i18nData)
    },
    undefined,
    { immediate: false }
  )

  async function startStoreBootstrap() {
    // Defer settings and workflows if multi-user login is required
    // (settings API requires authentication in multi-user mode)
    const userStore = useUserStore()
    await userStore.initialize()

    if (isCloud) {
      const { isInitialized } = storeToRefs(useFirebaseAuthStore())
      await until(isInitialized).toBe(true)
    }

    // i18n can load without authentication
    void loadI18n()

    if (!userStore.needsLogin) {
      void settingStore.load()
      void workflowStore.loadWorkflows()
    }
  }

  return {
    isI18nReady,
    i18nError,
    startStoreBootstrap
  }
})
