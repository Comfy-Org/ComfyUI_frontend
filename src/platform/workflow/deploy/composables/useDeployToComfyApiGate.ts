import type { FeatureFlagsCallback } from 'posthog-js'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'

export const DISTRIBUTIONS_FLAG = 'distributions_enabled'

export interface FlagReader {
  isFeatureEnabled(flag: string): boolean | undefined
  onFeatureFlags(callback: FeatureFlagsCallback): unknown
}

/**
 * Whether this account may reach the platform's build wizard. It is the
 * platform's own `distributions_enabled` PostHog flag, read here for the same
 * signed-in user, so the entry appears exactly where the wizard is open. Off
 * Cloud PostHog never initialises and the entry stays hidden; a development
 * build shows it regardless, as the agent panel does.
 */
export function createDeployToComfyApiGate(
  loadFlags: () => Promise<FlagReader>
): { enabled: Readonly<Ref<boolean>> } {
  const enabled = ref(import.meta.env.MODE === 'development')
  if (isCloud && !enabled.value) {
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
      })
  }
  return { enabled: readonly(enabled) }
}

let gate: ReturnType<typeof createDeployToComfyApiGate> | undefined

export function useDeployToComfyApiGate() {
  gate ??= createDeployToComfyApiGate(() =>
    import('posthog-js').then((module) => module.default)
  )
  return gate
}
