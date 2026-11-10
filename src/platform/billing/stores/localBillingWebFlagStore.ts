import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { z } from 'zod'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { desktopHostUser } from '@/platform/auth/desktopHost/desktopHostSession'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

const REREAD_INTERVAL_MS = 10 * 60_000
const READ_TIMEOUT_MS = 10_000

const zAllowlistedCloudFlags = z.object({ local_billing_web: z.boolean() })

function localSurface(): 'desktop' | 'local_web' {
  return isDesktop || window.__comfyDesktop2 !== undefined
    ? 'desktop'
    : 'local_web'
}

async function readLocalBillingWeb(): Promise<boolean> {
  try {
    const auth = await useAuthStore().getAuthHeader()
    if (!auth) return false
    const response = await fetch(
      new URL('/api/features', getComfyCloudBaseUrl()),
      {
        cache: 'no-store',
        headers: { ...auth, 'X-Comfy-Surface': localSurface() },
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
    const enabled = ref(false)
    let generation = 0

    function clear(): void {
      generation++
      enabled.value = false
    }

    async function reread(): Promise<void> {
      const current = ++generation
      const value = await readLocalBillingWeb()
      if (current === generation) enabled.value = value
    }

    if (!isCloud) {
      const authStore = useAuthStore()
      const teamWorkspaceStore = useTeamWorkspaceStore()

      watch(
        [
          () => authStore.userId ?? null,
          () =>
            teamWorkspaceStore.activeWorkspaceId ??
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

      useIntervalFn(() => {
        if (authStore.userId) void reread()
      }, REREAD_INTERVAL_MS)
    }

    return { enabled: computed(() => enabled.value) }
  }
)
