import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { z } from 'zod'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import {
  desktopHostTokenRecoveries,
  desktopHostUser
} from '@/platform/auth/desktopHost/desktopHostSession'
import {
  localBillingWebEnabled,
  localSurface,
  setLocalBillingWebEnabled
} from '@/platform/billing/localBillingWebEnabled'
import { isCloud } from '@/platform/distribution/types'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useAuthStore } from '@/stores/authStore'

const REREAD_INTERVAL_MS = 10 * 60_000
const READ_TIMEOUT_MS = 10_000

const zAllowlistedCloudFlags = z.object({ local_billing_web: z.boolean() })

async function readLocalBillingWeb(): Promise<boolean> {
  try {
    const token = await useAuthStore().getIdToken()
    if (!token) return false
    const response = await fetch(
      new URL('/api/features', getComfyCloudBaseUrl()),
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Comfy-Surface': localSurface()
        },
        signal: AbortSignal.timeout(READ_TIMEOUT_MS)
      }
    )
    if (!response.ok) return false
    const flags = zAllowlistedCloudFlags.safeParse(await response.json())
    return flags.success && flags.data.local_billing_web
  } catch {
    return false
  }
}

/**
 * Cloud's `local_billing_web` for the account signed in to local ComfyUI or
 * Desktop: false while unknown, signed out, on Cloud, or after a failed read.
 */
export const useLocalBillingWebFlagStore = defineStore(
  'localBillingWebFlag',
  () => {
    let generation = 0

    function clear(): void {
      generation++
      setLocalBillingWebEnabled(false)
    }

    async function reread(): Promise<void> {
      const current = ++generation
      const value = await readLocalBillingWeb()
      if (current === generation) setLocalBillingWebEnabled(value)
    }

    if (!isCloud) {
      const authStore = useAuthStore()
      const workspaceIdentity = useWorkspaceIdentity()

      watch(
        [
          () => authStore.userId ?? null,
          () =>
            workspaceIdentity.activeWorkspaceId ??
            desktopHostUser.value?.workspaceId ??
            null
        ],
        ([userId]) => {
          clear()
          if (userId) void reread()
        },
        { immediate: true }
      )

      watch(desktopHostUser, (user, previous) => {
        if (
          user &&
          user.id === previous?.id &&
          user.workspaceId === previous.workspaceId
        )
          void reread()
      })

      watch(desktopHostTokenRecoveries, () => {
        if (authStore.userId) void reread()
      })

      useIntervalFn(() => {
        if (authStore.userId) void reread()
      }, REREAD_INTERVAL_MS)
    }

    return { enabled: computed(() => localBillingWebEnabled.value) }
  }
)
