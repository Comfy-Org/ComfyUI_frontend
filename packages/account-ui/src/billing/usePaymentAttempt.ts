/**
 * What the top-up and checkout experiences share: the operation being
 * followed, the eight-state projection over it, the step the host reports,
 * and the two continuation effects — handing a hosted page to the host's
 * navigation and driving an embedded challenge through the host's port.
 * Which presentation an operation runs on is the lifecycle's decision; this
 * only acts on the one it was given.
 */
import { computed, ref, shallowReadonly, watch } from 'vue'
import type { Ref } from 'vue'

import type {
  BillingOperationKind,
  BillingOperationState,
  EmbeddedChallengePort,
  HostPaymentStep,
  PaymentProjection
} from '@comfyorg/account/billing'
import {
  driveEmbeddedChallenge,
  isTerminal,
  projectPaymentStep
} from '@comfyorg/account/billing'

import type { BillingClient } from './billingClient'
import { useBillingOperation } from './useBillingOperation'

/**
 * `preopened` names a tab the host opened inside the user's gesture, before
 * the operation existed, so a popup blocker never sees the continuation.
 */
export type OpenUrlMode = 'new_tab' | 'redirect' | 'preopened'

export interface PaymentNavigation {
  /** Host-owned: told where to go and in which mode, never how. */
  readonly openUrl: (url: string, mode: OpenUrlMode) => void
  readonly navigationMode?: OpenUrlMode
  /** Absent leaves an embedded challenge parked until the host switches it hosted. */
  readonly challengePort?: EmbeddedChallengePort
}

export interface PaymentAttempt {
  readonly operation: Readonly<Ref<BillingOperationState | undefined>>
  readonly projection: Readonly<Ref<PaymentProjection>>
  readonly hostStep: Readonly<Ref<HostPaymentStep>>
  readonly preview: () => void
  readonly cancel: () => void
  /** Drops a settled operation from view and returns the host to select. */
  readonly reset: () => void
  /** Re-runs the pending operation's continuation, for a click the host owns. */
  readonly continueVerification: () => void
}

function continuationKey(
  state: BillingOperationState | undefined
): string | undefined {
  if (state?.phase !== 'pending') return undefined
  if (state.presentation === 'hosted') {
    return state.actionUrl === undefined
      ? undefined
      : `${state.id}:${state.actionUrl}`
  }
  return state.challenge?.status === 'required'
    ? `${state.id}:${state.challenge.clientSecret}`
    : undefined
}

export function usePaymentAttempt(
  kind: BillingOperationKind,
  client: Pick<BillingClient, 'lifecycle'>,
  navigation: PaymentNavigation
): PaymentAttempt {
  const { openUrl, navigationMode = 'new_tab', challengePort } = navigation
  const tracked = useBillingOperation({ kind }, client)
  const dismissedId = ref<string>()
  const hostStep = ref<HostPaymentStep>('select')

  const operation = computed(() => {
    const state = tracked.value
    if (state === undefined) return undefined
    return isTerminal(state) && state.id === dismissedId.value
      ? undefined
      : state
  })
  const projection = computed(() =>
    projectPaymentStep(operation.value, hostStep.value)
  )

  function continueVerification() {
    const state = operation.value
    if (state?.phase !== 'pending') return
    if (state.presentation === 'hosted') {
      if (state.actionUrl !== undefined) {
        openUrl(state.actionUrl, navigationMode)
      }
      return
    }
    if (challengePort === undefined) return
    void driveEmbeddedChallenge(client.lifecycle, state.id, challengePort)
  }

  // Once per continuation the server offers; a resumed operation is not
  // re-entered on mount, since nothing the customer did asked for it.
  watch(
    () => continuationKey(operation.value),
    (key) => {
      if (key !== undefined) continueVerification()
    }
  )

  return {
    operation,
    projection,
    hostStep: shallowReadonly(hostStep),
    preview: () => {
      hostStep.value = 'preview'
    },
    cancel: () => {
      hostStep.value = 'canceled'
    },
    reset: () => {
      const state = tracked.value
      if (state !== undefined && isTerminal(state)) dismissedId.value = state.id
      hostStep.value = 'select'
    },
    continueVerification
  }
}
