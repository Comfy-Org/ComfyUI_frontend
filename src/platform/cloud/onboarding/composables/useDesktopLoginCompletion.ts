import { until } from '@vueuse/core'
import type { LocationQuery } from 'vue-router'

import { hasDesktopLoginRequest } from '@/platform/cloud/onboarding/desktopLoginBridge'
import { useAuthStore } from '@/stores/authStore'

export async function completeDesktopLoginForExistingSession(
  query: LocationQuery,
  onAuthSuccess: () => Promise<void>
): Promise<void> {
  if (!hasDesktopLoginRequest(query)) return

  const authStore = useAuthStore()
  if (!authStore.isInitialized) {
    await until(() => authStore.isInitialized).toBe(true)
  }

  if (!authStore.currentUser) return

  await onAuthSuccess()
}
