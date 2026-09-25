import type { FeatureFlagsCallback } from 'posthog-js'
import { effectScope, readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'

export const DISTRIBUTIONS_FLAG = 'distributions_enabled'

export interface FlagReader {
  isFeatureEnabled(flag: string): boolean | undefined
  onFeatureFlags(callback: FeatureFlagsCallback): unknown
}

interface GateHooks {
  onSignOut?: (hide: () => void) => void
  onLoadFailed?: () => void
}

/**
 * Whether this account may reach the platform's build wizard. It is the
 * platform's own `distributions_enabled` PostHog flag, read here for the same
 * signed-in user, so the entry appears exactly where the wizard is open. Off
 * Cloud PostHog never initialises and the entry stays hidden; a development
 * build shows it regardless, as the agent panel does. Signing out hides it
 * until the next account's flags arrive.
 */
export function createDeployToComfyApiGate(
  loadFlags: () => Promise<FlagReader>,
  { onSignOut, onLoadFailed }: GateHooks = {}
): { enabled: Readonly<Ref<boolean>> } {
  const enabled = ref(import.meta.env.MODE === 'development')
  if (isCloud && !enabled.value) {
    onSignOut?.(() => {
      enabled.value = false
    })
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
  }
  return { enabled: readonly(enabled) }
}

let gate: ReturnType<typeof createDeployToComfyApiGate> | undefined

export function useDeployToComfyApiGate() {
  gate ??= effectScope(true).run(() =>
    createDeployToComfyApiGate(
      () => import('posthog-js').then((module) => module.default),
      {
        onSignOut: (hide) => useCurrentUser().onUserLogout(hide),
        onLoadFailed: () => {
          gate = undefined
        }
      }
    )
  )!
  return gate
}
