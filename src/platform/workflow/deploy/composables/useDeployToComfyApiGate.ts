import { effectScope, readonly, shallowRef } from 'vue'
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

/**
 * `generation` changes when the signed-in account does (a sign-in of a
 * different user, or a sign-out), so a live flag change for the same account
 * keeps it.
 */
export type DeployGateState =
  | { readonly status: 'awaiting' }
  | {
      readonly status: 'answered'
      readonly generation: number
      readonly enabled: boolean
    }

interface DeployToComfyApiGate {
  state: Readonly<Ref<DeployGateState>>
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
  let generation = 0
  const developmentBuild = import.meta.env.MODE === 'development'
  const state = shallowRef<DeployGateState>({
    status: 'answered',
    generation,
    enabled: developmentBuild
  })
  if (developmentBuild) return { state: readonly(state), check: () => {} }

  let signedInUser: string | undefined
  let askedInGeneration: number | undefined
  let posthog: FlagReader | undefined
  let loading = false

  function answer(enabled: boolean): void {
    state.value = { status: 'answered', generation, enabled }
  }

  function syncFromPostHog(): void {
    if (signedInUser === undefined) answer(false)
    else if (posthog?.get_distinct_id() === signedInUser)
      answer(posthog.isFeatureEnabled(DISTRIBUTIONS_FLAG) === true)
    else state.value = { status: 'awaiting' }
  }

  function loadPostHog(): void {
    if (!isCloud || posthog || loading) return
    loading = true
    loadFlags()
      .then((reader) => {
        loading = false
        posthog = reader
        reader.onFeatureFlags((_flags, _variants, context) => {
          if (context?.errorsLoading) answer(false)
          else syncFromPostHog()
        })
        syncFromPostHog()
      })
      .catch((error: unknown) => {
        loading = false
        reportError(error, {
          errorType: 'error_loading_deploy_gate_flag',
          surface: 'platform'
        })
      })
  }

  function askPlatformOnce(): void {
    if (signedInUser === undefined || askedInGeneration === generation) return
    const asked = (askedInGeneration = generation)
    void askPlatform().then((enabled) => {
      if (asked === generation) answer(enabled)
    })
  }

  onSignOut(() => {
    signedInUser = undefined
    generation++
    answer(false)
  })
  onSignIn((userId) => {
    if (userId === signedInUser) return
    signedInUser = userId
    generation++
    if (isCloud) syncFromPostHog()
    else state.value = { status: 'awaiting' }
  })
  loadPostHog()

  return {
    state: readonly(state),
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
