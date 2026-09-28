import { effectScope, readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { loadPostHogFlags } from '@/platform/workflow/deploy/composables/postHogFlags'
import type { FlagReader } from '@/platform/workflow/deploy/composables/postHogFlags'
import { fetchDistributionsEnabled } from '@/platform/workflow/deploy/services/platformFlagsApi'
import { useAuthStore } from '@/stores/authStore'

const DISTRIBUTIONS_FLAG = 'distributions_enabled'

interface GateSources {
  loadFlags: () => Promise<FlagReader>
  askPlatform: () => Promise<boolean>
  onSignIn: (check: (userId: string) => void) => void
  onSignOut: (hide: () => void) => void
}

interface DeployToComfyApiGate {
  enabled: Readonly<Ref<boolean>>
  /** Whether `enabled` is an answer for the current account yet. */
  settled: Readonly<Ref<boolean>>
  /** Asks for an answer if none is in hand or on its way. Call on menu open. */
  check: () => void
}

/**
 * The platform's `distributions_enabled` flag for the account signed in now.
 * PostHog only starts in a Cloud build, and its flags can still belong to the
 * previous account until it is identified as the new one, so they count only
 * while its distinct id is the signed-in user. Off Cloud the platform is asked
 * only when a menu first needs the answer, so a signed-in user who never opens
 * one makes no cross-origin request.
 */
export function createDeployToComfyApiGate({
  loadFlags,
  askPlatform,
  onSignIn,
  onSignOut
}: GateSources): DeployToComfyApiGate {
  const enabled = ref(import.meta.env.MODE === 'development')
  const settled = ref(true)
  if (enabled.value)
    return {
      enabled: readonly(enabled),
      settled: readonly(settled),
      check: () => {}
    }

  let signedInUser: string | undefined
  let session = 0
  let askedInSession: number | undefined
  let posthog: FlagReader | undefined
  let loading = false

  function syncFromPostHog(): void {
    const identified =
      !!posthog &&
      signedInUser !== undefined &&
      posthog.get_distinct_id() === signedInUser
    enabled.value =
      identified && posthog?.isFeatureEnabled(DISTRIBUTIONS_FLAG) === true
    settled.value = signedInUser === undefined || identified
  }

  function loadPostHog(): void {
    if (!isCloud || posthog || loading) return
    loading = true
    loadFlags()
      .then((reader) => {
        loading = false
        posthog = reader
        reader.onFeatureFlags((_flags, _variants, context) => {
          if (!context?.errorsLoading) return syncFromPostHog()
          enabled.value = false
          settled.value = true
        })
        syncFromPostHog()
      })
      .catch((error: unknown) => {
        loading = false
        reportError(error, { errorType: 'error_loading_deploy_gate_flag' })
      })
  }

  function askPlatformOnce(): void {
    if (signedInUser === undefined || askedInSession === session) return
    const asked = (askedInSession = session)
    void askPlatform().then((answer) => {
      if (asked !== session) return
      enabled.value = answer
      settled.value = true
    })
  }

  onSignOut(() => {
    signedInUser = undefined
    session++
    enabled.value = false
    settled.value = true
  })
  onSignIn((userId) => {
    signedInUser = userId
    session++
    enabled.value = false
    if (isCloud) syncFromPostHog()
    else settled.value = false
  })
  loadPostHog()

  return {
    enabled: readonly(enabled),
    settled: readonly(settled),
    check: isCloud ? loadPostHog : askPlatformOnce
  }
}

let gate: DeployToComfyApiGate | undefined

export function useDeployToComfyApiGate(): DeployToComfyApiGate {
  gate ??= effectScope(true).run(() => {
    const currentUser = useCurrentUser()
    return createDeployToComfyApiGate({
      loadFlags: loadPostHogFlags,
      askPlatform: () =>
        fetchDistributionsEnabled(() => useAuthStore().getAuthHeader()),
      onSignIn: (check) => currentUser.onUserResolved((user) => check(user.id)),
      onSignOut: (hide) => currentUser.onUserLogout(hide)
    })
  })!
  return gate
}
