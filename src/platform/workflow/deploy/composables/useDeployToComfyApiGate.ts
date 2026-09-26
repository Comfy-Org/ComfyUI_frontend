import type { FeatureFlagsCallback } from 'posthog-js'
import { effectScope, readonly, ref } from 'vue'
import type { Ref } from 'vue'
import { z } from 'zod'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

export const DISTRIBUTIONS_FLAG = 'distributions_enabled'
const PLATFORM_FLAG_PATH = '/api/flags/distributions-enabled'
const zPlatformFlag = z.object({ enabled: z.boolean() })

interface FlagReader {
  isFeatureEnabled(flag: string): boolean | undefined
  onFeatureFlags(callback: FeatureFlagsCallback): unknown
}

interface GateSources {
  /** Cloud: PostHog, which only a Cloud build starts. */
  loadFlags: () => Promise<FlagReader>
  /** Off Cloud: the platform, which evaluates its own flag for this user. */
  askPlatform: () => Promise<boolean>
  onSignIn: (check: () => void) => void
  onSignOut: (hide: () => void) => void
  onLoadFailed?: () => void
}

/**
 * Whether this account may reach the platform's build wizard: the platform's
 * own `distributions_enabled` flag, for the same signed-in user. On Cloud it
 * is read from PostHog. Localhost and Desktop never start PostHog, so there
 * the platform answers for its flag each time a user signs in. Signed out, the
 * entry is hidden everywhere. A development build shows it regardless, as the
 * agent panel does.
 */
export function createDeployToComfyApiGate({
  loadFlags,
  askPlatform,
  onSignIn,
  onSignOut,
  onLoadFailed
}: GateSources): { enabled: Readonly<Ref<boolean>> } {
  const enabled = ref(import.meta.env.MODE === 'development')
  if (enabled.value) return { enabled: readonly(enabled) }

  let session = 0
  onSignOut(() => {
    session++
    enabled.value = false
  })

  if (isCloud) {
    loadFlags()
      .then((posthog) => {
        const sync = () => {
          enabled.value = posthog.isFeatureEnabled(DISTRIBUTIONS_FLAG) === true
        }
        posthog.onFeatureFlags((_flags, _variants, context) => {
          if (!context?.errorsLoading) sync()
        })
        sync()
      })
      .catch((error: unknown) => {
        reportError(error, { errorType: 'error_loading_deploy_gate_flag' })
        onLoadFailed?.()
      })
  } else {
    onSignIn(() => {
      const asked = ++session
      void askPlatform().then((answer) => {
        if (asked === session) enabled.value = answer
      })
    })
  }
  return { enabled: readonly(enabled) }
}

/**
 * The platform's answer for the signed-in account. Anything but a clear yes,
 * including a platform that does not serve the route yet, keeps the entry
 * hidden.
 */
export async function askPlatformForDistributions(
  getAuthHeader: () => Promise<AuthHeader | null>
): Promise<boolean> {
  try {
    const header = await getAuthHeader()
    if (!header || !('Authorization' in header)) return false
    const response = await fetch(
      new URL(PLATFORM_FLAG_PATH, getComfyPlatformBaseUrl()),
      { headers: header }
    )
    if (!response.ok) return false
    const answer = zPlatformFlag.safeParse(await response.json())
    return answer.success && answer.data.enabled
  } catch {
    return false
  }
}

let gate: ReturnType<typeof createDeployToComfyApiGate> | undefined

export function useDeployToComfyApiGate() {
  gate ??= effectScope(true).run(() => {
    const currentUser = useCurrentUser()
    return createDeployToComfyApiGate({
      loadFlags: () => import('posthog-js').then((module) => module.default),
      askPlatform: () =>
        askPlatformForDistributions(() => useAuthStore().getAuthHeader()),
      onSignIn: (check) => currentUser.onUserResolved(check),
      onSignOut: (hide) => currentUser.onUserLogout(hide),
      onLoadFailed: () => {
        gate = undefined
      }
    })
  })!
  return gate
}
