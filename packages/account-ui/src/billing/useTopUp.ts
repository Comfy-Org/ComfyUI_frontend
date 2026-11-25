/**
 * The headless top-up: amount selection against host-owned presets and
 * bounds, the server's `can_top_up` verdict, one command on the shared
 * lifecycle, and the projection a host renders. Nothing here formats money,
 * opens a window, or knows a route.
 */
import { computed, ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type {
  CapabilitiesSnapshot,
  CapabilityDenialReason,
  TopupInvalidAmount,
  TopupResult
} from '@comfyorg/account-core/billing'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'
import type { PaymentAttempt, PaymentNavigation } from './usePaymentAttempt'
import { usePaymentAttempt } from './usePaymentAttempt'

export interface TopUpOptions extends PaymentNavigation {
  readonly client?: Pick<BillingClient, 'lifecycle' | 'capabilities' | 'topup'>
  /** Host-owned, in cents; the core knows only the contract floor. */
  readonly presetsCents?: readonly number[]
  readonly minAmountCents?: number
  readonly maxAmountCents?: number
  readonly initialAmountCents?: number
  /** Display rate for `credits`; absent leaves it undefined. */
  readonly creditsPerDollar?: number
}

export interface TopUp extends PaymentAttempt {
  /** The server's verdict from the capabilities snapshot; undefined until one is read. */
  readonly canTopUp: Readonly<Ref<boolean | undefined>>
  readonly denial: Readonly<Ref<CapabilityDenialReason | undefined>>
  readonly refreshCapabilities: () => Promise<void>
  readonly presetsCents: readonly number[]
  readonly minAmountCents: number
  readonly maxAmountCents: number
  readonly amountCents: Ref<number>
  readonly amountValid: Readonly<Ref<boolean>>
  readonly credits: Readonly<Ref<number | undefined>>
  readonly submitting: Readonly<Ref<boolean>>
  readonly result: Readonly<Ref<TopupResult | undefined>>
  readonly submit: () => Promise<TopupResult>
  /** Drops the settled attempt and submits the current amount again. */
  readonly retry: () => Promise<TopupResult>
}

const DEFAULT_PRESETS_CENTS: readonly number[] = [1000, 2500, 5000, 10000]
const DEFAULT_MIN_AMOUNT_CENTS = 500
const DEFAULT_MAX_AMOUNT_CENTS = 1_000_000

const INVALID_AMOUNT = {
  status: 'error',
  code: 'INVALID_AMOUNT'
} as const satisfies TopupInvalidAmount

export function useTopUp(options: TopUpOptions): TopUp {
  const client = useBillingClient(options.client)
  const {
    presetsCents = DEFAULT_PRESETS_CENTS,
    minAmountCents = DEFAULT_MIN_AMOUNT_CENTS,
    maxAmountCents = DEFAULT_MAX_AMOUNT_CENTS,
    initialAmountCents = presetsCents[0] ?? minAmountCents,
    creditsPerDollar
  } = options
  const attempt = usePaymentAttempt('topup', client, options)

  const capabilities = ref<CapabilitiesSnapshot | undefined>(
    client.capabilities.getSnapshot()
  )
  const canTopUp = computed(() => capabilities.value?.capabilities.can_top_up)
  const denial = computed(() => capabilities.value?.denials.can_top_up)

  async function refreshCapabilities() {
    const read = await client.capabilities.read()
    if (read.status === 'ok') capabilities.value = read.value
  }
  void refreshCapabilities()

  const amountCents = ref(initialAmountCents)
  const amountValid = computed(
    () =>
      Number.isInteger(amountCents.value) &&
      amountCents.value >= minAmountCents &&
      amountCents.value <= maxAmountCents
  )
  const credits = computed(() =>
    creditsPerDollar === undefined
      ? undefined
      : Math.round((amountCents.value / 100) * creditsPerDollar)
  )

  const submitting = ref(false)
  const result = ref<TopupResult | undefined>()

  async function submit(): Promise<TopupResult> {
    if (!amountValid.value) {
      result.value = INVALID_AMOUNT
      return INVALID_AMOUNT
    }
    submitting.value = true
    const outcome = await client.topup.createTopupCheckout({
      amountCents: amountCents.value
    })
    submitting.value = false
    result.value = outcome
    // A settled purchase invalidated the core's snapshot; the verdict shown
    // next to the button follows the server, not the last read.
    if (outcome.status === 'ok') await refreshCapabilities()
    return outcome
  }

  function retry() {
    attempt.reset()
    attempt.preview()
    result.value = undefined
    return submit()
  }

  return {
    ...attempt,
    canTopUp,
    denial,
    refreshCapabilities,
    presetsCents,
    minAmountCents,
    maxAmountCents,
    amountCents,
    amountValid,
    credits,
    submitting: shallowReadonly(submitting),
    result: shallowReadonly(result),
    submit,
    retry
  }
}
