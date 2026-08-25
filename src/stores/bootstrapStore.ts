import { until, useAsyncState } from '@vueuse/core'
import axios from 'axios'
import { defineStore, storeToRefs } from 'pinia'

import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
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

// Matches the Firebase-auth-wait timeout used elsewhere (router.ts,
// WorkspaceAuthGate.vue) so a broken/stale session fails this bounded wait
// on the same schedule those already fail theirs.
const AUTH_WAIT_TIMEOUT_MS = 16_000
const AUTH_WAIT_RETRY_DELAY_MS = 3_000

/**
 * Waits for Firebase auth initialization to complete, bounded so a stale
 * token or a broken auth response can never hang bootstrap forever.
 *
 * Only isInitialized is awaited — onAuthStateChanged fires with null for
 * signed-out users, which sets isInitialized but not isAuthenticated.
 * Awaiting isAuthenticated here would make every signed-out page load wait
 * 35s and fire a false Sentry timeout. The router guard handles the
 * login redirect for unauthenticated users separately.
 *
 * Retries once after a short delay; if auth is still unresolved, reports it
 * to every observability sink and lets bootstrap continue rather than leaving
 * the caller stuck.
 */
async function waitForCloudAuth(): Promise<void> {
  const { isInitialized } = storeToRefs(useAuthStore())
  const waitForResolution = () =>
    until(isInitialized).toBe(true, {
      timeout: AUTH_WAIT_TIMEOUT_MS,
      throwOnTimeout: true
    })

  try {
    await waitForResolution()
  } catch (error) {
    console.warn(
      '[bootstrapStore] Auth did not resolve in time, retrying once',
      error
    )
    await new Promise((resolve) =>
      setTimeout(resolve, AUTH_WAIT_RETRY_DELAY_MS)
    )
    try {
      await waitForResolution()
    } catch (retryError) {
      console.error(
        '[bootstrapStore] Auth still unresolved after retry; continuing bootstrap without confirmed auth',
        retryError
      )
      reportError(retryError, { errorType: 'bootstrap_auth_wait_timeout' })
    }
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
      await waitForCloudAuth()
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
