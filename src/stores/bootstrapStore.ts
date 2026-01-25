import { useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { useUserStore } from '@/stores/userStore'

export const useBootstrapStore = defineStore('bootstrap', () => {
  const {
    state: nodeDefs,
    isReady: isNodeDefsReady,
    error: nodeDefsError,
    execute: fetchNodeDefs
  } = useAsyncState<Record<string, ComfyNodeDef>>(
    async () => {
      const defs = await api.getNodeDefs()
      return defs
    },
    {},
    { immediate: false }
  )

  const {
    isReady: isSettingsReady,
    isLoading: isSettingsLoading,
    error: settingsError,
    execute: executeLoadSettings
  } = useAsyncState(
    async () => {
      const { useSettingStore } =
        await import('@/platform/settings/settingStore')
      await useSettingStore().loadSettingValues()
    },
    undefined,
    { immediate: false }
  )

  function loadSettings() {
    // TODO: This check makes the store "sticky" across logouts. Add a reset
    // method to clear isSettingsReady, then replace window.location.reload()
    // with router.push() in SidebarLogoutIcon.vue
    if (!isSettingsReady.value && !isSettingsLoading.value) {
      void executeLoadSettings()
    }
  }

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

  const {
    isReady: isWorkflowsReady,
    isLoading: isWorkflowsLoading,
    execute: executeSyncWorkflows
  } = useAsyncState(
    async () => {
      const { useWorkspaceStore } = await import('@/stores/workspaceStore')
      await useWorkspaceStore().workflow.syncWorkflows()
    },
    undefined,
    { immediate: false }
  )

  function syncWorkflows() {
    if (!isWorkflowsReady.value && !isWorkflowsLoading.value) {
      void executeSyncWorkflows()
    }
  }

  function startEarlyBootstrap() {
    void fetchNodeDefs()
  }

  async function startStoreBootstrap() {
    // Defer settings and workflows if multi-user login is required
    // (settings API requires authentication in multi-user mode)
    const userStore = useUserStore()
    await userStore.initialize()

    // i18n can load without authentication
    void loadI18n()

    if (!userStore.needsLogin) {
      loadSettings()
      syncWorkflows()
    }
  }

  return {
    nodeDefs,
    isNodeDefsReady,
    nodeDefsError,
    isSettingsReady,
    settingsError,
    isI18nReady,
    i18nError,
    startEarlyBootstrap,
    startStoreBootstrap,
    loadSettings,
    syncWorkflows
  }
})
