<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { CheckoutTermsNote } from '@comfyorg/account-ui/billing/checkout'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { InlineOutcome, SubmitPhase } from '@/checkout/checkoutPage'
import { isChallengeReopenable } from '@/checkout/checkoutPage'
import { supportLinkFor } from '@/checkout/payVerdict'
import InlineOutcomeCard from '@/components/fullPage/InlineOutcomeCard.vue'
import type { KeepSubscriptionConsent } from '@/components/fullPage/KeepSubscriptionNotice.vue'
import KeepSubscriptionNotice from '@/components/fullPage/KeepSubscriptionNotice.vue'

/** What the last Pay left, and the consent a plan set to end needs, around the button. */
export interface PayContext {
  readonly outcome?: Exclude<InlineOutcome, { kind: 'reconciling' }>
  readonly consent?: KeepSubscriptionConsent
}

const {
  disabled,
  loading = false,
  phase,
  canCancel = false,
  outcome,
  consent
} = defineProps<
  PayContext & {
    disabled: boolean
    loading?: boolean
    /** The submit area's phase; only the visible pay action carries one, so the page has one live region. */
    phase?: SubmitPhase
    /** Cancel payment renders only once the server can cancel a pending payment. */
    canCancel?: boolean
  }
>()

const emit = defineEmits<{
  confirmReactivation: [confirmed: boolean]
  consentMissing: []
  cancel: []
  continueVerification: []
}>()

const { t, te } = useI18n()

/** Support is for a payment that failed; a notice over a fresh price is not one. */
const supportLink = computed(() =>
  outcome !== undefined &&
  ('operationId' in outcome ||
    (outcome.kind === 'processing_error' && 'code' in outcome))
    ? supportLinkFor(outcome)
    : undefined
)

/** Pay without the tick submits nothing and hands the click back to the consent. */
function guardConsent(event: Event) {
  if (consent === undefined || consent.state === 'confirmed') return
  event.preventDefault()
  emit('consentMissing')
}

/** The line above Pay for a phase in flight; empty at rest so the live region stays mounted. */
const footnote = computed(() => {
  if (
    phase === undefined ||
    phase.kind === 'capture' ||
    phase.kind === 'unknown'
  )
    return ''
  if (phase.kind === 'challenge') return t('checkout.fullPage.phase.challenge')
  if (phase.kind === 'processing')
    return t('checkout.fullPage.phase.processing')
  const named = `checkout.fullPage.phase.methods.${phase.method}`
  return te(named)
    ? t('checkout.fullPage.phase.redirecting', { method: t(named) })
    : t('checkout.fullPage.phase.redirectingUnnamed')
})

const challenge = computed(() =>
  phase?.kind === 'challenge' ? phase.operation : undefined
)

/** A challenge the page is not showing turns Pay into the one way back to it. */
const reopenable = computed(
  () => challenge.value !== undefined && isChallengeReopenable(challenge.value)
)

const PRIMARY_BUTTON =
  'flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-base-foreground px-4 text-sm font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40'

const SECONDARY_BUTTON =
  'flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-tertiary-background px-4 text-sm font-semibold text-base-foreground hover:bg-tertiary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none'
</script>

<template>
  <div class="flex flex-col gap-6">
    <InlineOutcomeCard
      v-if="outcome"
      :key="`${outcome.kind}:${'operationId' in outcome ? outcome.operationId : ''}`"
      :outcome
    />
    <KeepSubscriptionNotice
      v-if="consent"
      :consent
      @confirm="emit('confirmReactivation', $event)"
    />
    <div class="flex flex-col gap-4">
      <p
        v-if="phase"
        role="status"
        aria-live="polite"
        :class="
          cn(
            'm-0 text-center text-xs/4 text-muted-foreground',
            footnote === '' && 'sr-only'
          )
        "
        data-testid="checkout-phase-footnote"
      >
        {{ footnote }}
      </p>
      <button
        v-if="reopenable"
        type="button"
        :class="PRIMARY_BUTTON"
        @click="emit('continueVerification')"
      >
        {{ t('checkout.fullPage.phase.completeVerification') }}
      </button>
      <button
        v-else
        type="submit"
        :disabled="disabled || loading"
        :aria-busy="loading"
        :class="PRIMARY_BUTTON"
        @click="guardConsent"
      >
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] size-4 motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span :class="cn(loading && 'sr-only')">
          {{ t('checkout.payAndSubscribe') }}
        </span>
      </button>
      <button
        v-if="challenge && canCancel"
        type="button"
        :class="SECONDARY_BUTTON"
        @click="emit('cancel')"
      >
        {{ t('checkout.fullPage.phase.cancel') }}
      </button>
      <a
        v-if="supportLink"
        :href="supportLink"
        :class="
          cn(
            buttonVariants({ variant: 'tertiary', size: 'lg' }),
            'w-full font-semibold no-underline'
          )
        "
      >
        {{ t('checkout.fullPage.outcome.contactSupport') }}
      </a>
      <CheckoutTermsNote
        :copy="{
          agreement: t('checkout.fullPage.terms.agreement', {
            terms: '{terms}',
            privacy: '{privacy}'
          }),
          terms: t('checkout.fullPage.terms.terms'),
          privacyPolicy: t('checkout.fullPage.terms.privacyPolicy')
        }"
      />
    </div>
  </div>
</template>
