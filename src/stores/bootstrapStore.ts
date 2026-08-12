import { until, useAsyncState } from '@vueuse/core'
import axios from 'axios'
import { defineStore, storeToRefs } from 'pinia'

import { isCloud } from '@/platform/distribution/types'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
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

    const phaseSettings = bootstrapTracer.startPhase('bootstrap/settings')
    void settingStore.load()?.then(() => phaseSettings.stop())

    const phaseWorkflows = bootstrapTracer.startPhase('bootstrap/workflows')
    void workflowStore.loadWorkflows()?.then(() => phaseWorkflows.stop())
  }

  async function startStoreBootstrap() {
    if (isCloud) {
      const { isInitialized, isAuthenticated } = storeToRefs(useAuthStore())

      const phaseInit = bootstrapTracer.startPhase('auth-gate/initialized')
      await until(isInitialized).toBe(true)
      phaseInit.stop()

      const phaseAuth = bootstrapTracer.startPhase('auth-gate/authenticated')
      await until(isAuthenticated).toBe(true)
      phaseAuth.stop()
    }

    const userStore = useUserStore()
    const phaseUser = bootstrapTracer.startPhase('auth-gate/user-store')
    await userStore.initialize()
    phaseUser.stop()

    const { needsLogin } = storeToRefs(userStore)
    const phaseLogin = bootstrapTracer.startPhase('auth-gate/needs-login')
    await until(needsLogin).toBe(false)
    phaseLogin.stop()

    void loadI18n()
    loadAuthenticatedStores()

    bootstrapTracer.milestone('stores-ready')
    bootstrapTracer.logSummary()
  }

  return {
    isI18nReady,
    i18nError,
    startStoreBootstrap
  }
})
