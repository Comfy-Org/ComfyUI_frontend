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
  CheckoutMethodKind,
  EmbeddedChallengePort,
  HostPaymentStep,
  PaymentProjection,
  PendingBillingOperation
} from '@comfyorg/account-core/billing'
import {
  driveEmbeddedChallenge,
  isTerminal,
  projectPaymentStep
} from '@comfyorg/account-core/billing'

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
  /**
   * Whether a continuation the server offers runs without a click. A host
   * that declines one runs it later through `continueVerification`.
   */
  readonly autoContinue?: (state: PendingBillingOperation) => boolean
  /** The method the customer chose, reported with the hosted step it leads to. */
  readonly methodKind?: () => CheckoutMethodKind | undefined
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

/** A non-card method finishes its challenge on the provider's site. */
function leavesForProvider(
  state: PendingBillingOperation,
  method: CheckoutMethodKind | undefined
): boolean {
  return (
    state.challenge?.status === 'required' &&
    method !== undefined &&
    method !== 'card'
  )
}

export function usePaymentAttempt(
  kind: BillingOperationKind,
  client: Pick<BillingClient, 'lifecycle'>,
  navigation: PaymentNavigation
): PaymentAttempt {
  const {
    openUrl,
    navigationMode = 'new_tab',
    challengePort,
    autoContinue = () => true,
    methodKind = () => undefined
  } = navigation
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

  function openHostedStep(
    state: PendingBillingOperation,
    method: CheckoutMethodKind | undefined
  ) {
    if (state.actionUrl === undefined) return
    client.lifecycle.reportHostedStepOpened(
      state.id,
      navigationMode === 'redirect' ? 'redirect' : 'new_tab',
      method
    )
    openUrl(state.actionUrl, navigationMode)
  }

  function driveChallenge(
    state: PendingBillingOperation,
    method: CheckoutMethodKind | undefined
  ) {
    if (challengePort === undefined) return
    if (leavesForProvider(state, method)) {
      client.lifecycle.reportHostedStepOpened(state.id, 'redirect', method)
    }
    void driveEmbeddedChallenge(client.lifecycle, state.id, challengePort)
  }

  function continueVerification() {
    const state = operation.value
    if (state?.phase !== 'pending') return
    const method = methodKind()
    if (state.presentation === 'hosted') openHostedStep(state, method)
    else driveChallenge(state, method)
  }

  // Once per continuation the server offers; a resumed operation is not
  // re-entered on mount, since nothing the customer did asked for it.
  watch(
    () => continuationKey(operation.value),
    (key) => {
      const state = operation.value
      if (
        key !== undefined &&
        state?.phase === 'pending' &&
        autoContinue(state)
      )
        continueVerification()
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
