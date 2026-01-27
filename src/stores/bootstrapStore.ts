import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useUserStore } from '@/stores/userStore'

export const useBootstrapStore = defineStore('bootstrap', () => {
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()
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

  function startEarlyBootstrap() {
    void nodeDefStore.load()
  }

  async function startStoreBootstrap() {
    const userStore = useUserStore()
    await userStore.initialize()

    void loadI18n()

    if (!userStore.needsLogin) {
      await settingStore.load()
      await workflowStore.loadWorkflows()
    }
  }

  return {
    isI18nReady,
    i18nError,
    startEarlyBootstrap,
    startStoreBootstrap
  }
})
