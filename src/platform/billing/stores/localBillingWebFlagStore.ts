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
  setLocalBillingNewUxEnabled,
  setLocalBillingWebEnabled
} from '@/platform/billing/localBillingWebEnabled'
import { isCloud } from '@/platform/distribution/types'
import { setLocalOpenOnCloudFlags } from '@/platform/openOnCloud/localOpenOnCloudFlags'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useAuthStore } from '@/stores/authStore'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const REREAD_INTERVAL_MS = 10 * 60_000
const READ_TIMEOUT_MS = 10_000

const zLocalBillingWeb = z.object({ local_billing_web: z.literal(true) })
const zBillingNewUx = z.object({ billing_new_ux_enabled: z.literal(true) })
const zOpenOnCloud = z.object({
  open_on_cloud_enabled: z.boolean().optional().catch(undefined),
  open_on_cloud_use_local_agent_enabled: z.boolean().optional().catch(undefined)
})

interface LocalCloudFlags {
  readonly localBillingWeb: boolean
  readonly billingNewUx: boolean
  readonly openOnCloud: boolean | undefined
  readonly openOnCloudUseLocalAgent: boolean | undefined
}

const ALL_OFF: LocalCloudFlags = {
  localBillingWeb: false,
  billingNewUx: false,
  openOnCloud: undefined,
  openOnCloudUseLocalAgent: undefined
}

async function readServedFlags(): Promise<LocalCloudFlags> {
  try {
    const token = await useAuthStore().getIdToken()
    if (!token) return ALL_OFF
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
    if (!response.ok) return ALL_OFF
    const served: unknown = await response.json()
    const openOnCloud = zOpenOnCloud.safeParse(served).data
    return {
      localBillingWeb: zLocalBillingWeb.safeParse(served).success,
      billingNewUx: zBillingNewUx.safeParse(served).success,
      openOnCloud: openOnCloud?.open_on_cloud_enabled,
      openOnCloudUseLocalAgent:
        openOnCloud?.open_on_cloud_use_local_agent_enabled
    }
  } catch {
    return ALL_OFF
  }
}

async function readLocalCloudFlags(): Promise<LocalCloudFlags> {
  const served = await readServedFlags()
  const override = getDevOverride<boolean>('local_billing_web')
  if (typeof override !== 'boolean') return served
  return { ...served, localBillingWeb: override, billingNewUx: false }
}

let generation = 0

export const useLocalBillingWebFlagStore = defineStore(
  'localBillingWebFlag',
  () => {
    function apply(flags: LocalCloudFlags): void {
      setLocalBillingWebEnabled(flags.localBillingWeb)
      setLocalBillingNewUxEnabled(flags.billingNewUx)
      setLocalOpenOnCloudFlags({
        enabled: flags.openOnCloud,
        useLocalAgentEnabled: flags.openOnCloudUseLocalAgent
      })
    }

    function clear(): void {
      generation++
      apply(ALL_OFF)
    }

    async function reread(): Promise<void> {
      const current = ++generation
      const flags = await readLocalCloudFlags()
      if (current === generation) apply(flags)
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
