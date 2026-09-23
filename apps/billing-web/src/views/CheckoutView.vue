<script setup lang="ts">
/**
 * The hosted checkout: the server's quote on the left, the shared Stripe form
 * on the right, and `commands.subscribe` in between. Every payment state
 * after the card is submitted comes from the lifecycle's projection, so this
 * page renders what the SDK says and never keeps a payment state of its own.
 * A hosted continuation redirects this tab and comes back on `/v1/result`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type {
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import {
  CheckoutSteps,
  useCheckout,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import type { StripePaymentCopy } from '@comfyorg/account-ui/billing/stripe'
import { StripePaymentForm } from '@comfyorg/account-ui/billing/stripe'
import {
  billingIntentPath,
  buildBillingEntryUrl,
  buildReturnUrl
} from '@comfyorg/billing-contract'

import CheckoutSubmit from '@/components/CheckoutSubmit.vue'
import EmbeddedCheckout from '@/components/EmbeddedCheckout.vue'
import HostedSurface from '@/components/HostedSurface.vue'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { BILLING_WEB_ENV, STRIPE_PUBLISHABLE_KEY } from '@/config/env'
import { useBillingEntry } from '@/entry/billingEntry'
import { createStripeChallengePort } from '@/session/stripeChallengePort'

const { t } = useI18n()
const { coded } = useHostedCopy()
const route = useRoute()
const router = useRouter()
const { entry } = useBillingEntry()
const billedWorkspace = useBilledWorkspace()

const planSlug = computed(() => entry.value?.plan)
const teamCreditStopId = computed(() => entry.value?.teamCreditStopId)

const {
  preview,
  loading,
  failure,
  quote,
  reset: resetQuote
} = usePreviewSubscribe()

const challengePort =
  STRIPE_PUBLISHABLE_KEY === undefined
    ? undefined
    : createStripeChallengePort(STRIPE_PUBLISHABLE_KEY)

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  challengePort
})

const quotedPlan = ref<string | undefined>()
const quotedTeamCreditStopId = ref<string | undefined>()

function quotePlan(slug: string | undefined, stopId: string | undefined) {
  quotedPlan.value = slug
  quotedTeamCreditStopId.value = stopId
  if (slug !== undefined) {
    void quote({
      planSlug: slug,
      ...(stopId === undefined ? {} : { teamCreditStopId: stopId })
    })
  }
}

onMounted(() => quotePlan(planSlug.value, teamCreditStopId.value))

// The route record is shared, so arriving with a different plan (or, for a
// team plan, a different credit stop) reuses the view. A payment in flight
// outranks the new link — repricing under it would show one plan's summary
// beside another plan's steps — but that deferral has to be made good the
// moment the operation is dismissed, or the form returns pricing what the
// customer left. Watching the operation is what closes that gap;
// `quotedPlan`/`quotedTeamCreditStopId` are what tell the two apart.
watch(
  [planSlug, teamCreditStopId, () => checkout.operation.value !== undefined],
  ([slug, stopId, busy]) => {
    if (
      busy ||
      (slug === quotedPlan.value && stopId === quotedTeamCreditStopId.value)
    ) {
      return
    }
    resetQuote()
    quotePlan(slug, stopId)
  }
)

/**
 * A cancelled subscription is reactivated by subscribing again, and the server
 * wants that charge confirmed in so many words: the quote says so up front
 * (`requires_reactivation_confirmation`), or the subscribe answers
 * `REACTIVATION_CONFIRMATION_REQUIRED` and the plan is re-quoted before the
 * customer is asked. Either way the form does not submit until they agree.
 */
const reactivationRequired = ref(false)
const reactivationConfirmed = ref(false)
const submitFailure = ref<string | undefined>()

watch(preview, (quoted) => {
  submitFailure.value = undefined
  reactivationRequired.value =
    quoted?.requires_reactivation_confirmation === true
  reactivationConfirmed.value = false
})

const canSubmit = computed(
  () =>
    (preview.value?.allowed ?? false) &&
    (!reactivationRequired.value || reactivationConfirmed.value)
)

const paymentCopy = computed<StripePaymentCopy>(() => ({
  paymentMethod: t('checkout.paymentMethod'),
  methodChoice: t('checkout.methodChoice'),
  billingAddress: t('checkout.billingAddress'),
  alipayRenewalNote: t('checkout.alipayRenewalNote'),
  unavailable: t('checkout.unavailable'),
  genericError: t('checkout.genericError')
}))

const summary = computed(() => {
  const quoted = preview.value
  if (!quoted) return undefined
  return {
    planName: t('hosted.plan.name', {
      tier: coded('tier', quoted.new_plan.tier),
      duration: coded('duration', quoted.new_plan.duration)
    }),
    priceCents: quoted.new_plan.price_cents,
    amountDueCents: quoted.amount_due_cents ?? quoted.cost_today_cents,
    creditsCents: quoted.new_plan.credits_cents,
    billingCycle: cycleOf(quoted)
  }
})

function cycleOf(quoted: SubscriptionPreview): 'monthly' | 'yearly' {
  return quoted.new_plan.duration === 'MONTHLY' ? 'monthly' : 'yearly'
}

const amountCents = computed(
  () => preview.value?.amount_due_cents ?? preview.value?.cost_today_cents ?? 0
)

const currency = computed(() => preview.value?.currency ?? 'usd')

const paymentMethodConfigurationId = computed(
  () => preview.value?.payment_method_configuration_id ?? ''
)

const publishableKey = STRIPE_PUBLISHABLE_KEY ?? ''

const quoting = computed(() => loading.value && summary.value === undefined)

const phase = computed(() =>
  checkout.projection.value.step === 'success' ? 'success' : 'payment'
)

const productName = computed(() => coded('product', entry.value?.product))

const returnLink = computed(() => {
  const arrival = entry.value
  if (!arrival) return undefined
  const url = buildReturnUrl({
    target: arrival.returnTo,
    environment: BILLING_WEB_ENV,
    workspace: billedWorkspace(),
    result: phase.value === 'success' ? 'success' : undefined,
    reference: checkout.projection.value.operationId
  })
  return url?.href
})

/** Where a hosted payment step sends the customer back: this origin, same request. */
function resultUrl(): string | undefined {
  const arrival = entry.value
  if (!arrival) return undefined
  const workspaceId = billedWorkspace()
  const built = buildBillingEntryUrl({
    billingOrigin: window.location.origin,
    intent: 'result',
    product: arrival.product,
    returnTo: arrival.returnTo,
    ...(arrival.plan === undefined ? {} : { plan: arrival.plan }),
    ...(arrival.teamCreditStopId === undefined
      ? {}
      : { teamCreditStopId: arrival.teamCreditStopId }),
    ...(workspaceId === undefined ? {} : { workspaceId })
  })
  return built.status === 'ok' ? built.url.href : undefined
}

/** The quote's identity travels with the charge, so the server prices what the customer saw. */
function subscribeRequest(
  plan: string,
  confirmationToken: string,
  quoted: SubscriptionPreview
): SubscribeInput {
  const returnUrl = resultUrl()
  return {
    plan_slug: plan,
    confirmation_token: confirmationToken,
    ...(teamCreditStopId.value === undefined
      ? {}
      : { team_credit_stop_id: teamCreditStopId.value }),
    ...(quoted.quote_id === undefined ? {} : { quote_id: quoted.quote_id }),
    ...(quoted.quote_version === undefined
      ? {}
      : { quote_version: quoted.quote_version }),
    ...(quoted.is_immediate && quoted.proration_at !== undefined
      ? { proration_at: quoted.proration_at }
      : {}),
    ...(returnUrl === undefined ? {} : { return_url: returnUrl }),
    ...(reactivationConfirmed.value ? { confirm_reactivation: true } : {})
  }
}

async function confirm(confirmationToken: string) {
  const quoted = preview.value
  if (planSlug.value === undefined || !quoted || loading.value) return
  submitFailure.value = undefined
  const result = await checkout.subscribe(
    subscribeRequest(planSlug.value, confirmationToken, quoted)
  )
  if (result.status === 'ok') return
  if (result.code === 'REACTIVATION_CONFIRMATION_REQUIRED') {
    // The quote did not say so, the server did: price it again and ask.
    await quote({ planSlug: planSlug.value })
    reactivationRequired.value = true
    return
  }
  submitFailure.value = coded('failure', result.code)
}

function back() {
  void router.push({
    path: billingIntentPath('subscription'),
    query: route.query
  })
}

function close() {
  const href = returnLink.value
  if (href === undefined) back()
  else window.location.assign(href)
}

const subscriptionPath = computed(() => ({
  path: billingIntentPath('subscription'),
  query: route.query
}))
</script>

<template>
  <HostedSurface v-if="planSlug === undefined">
    <section
      class="rounded-xl border border-border-subtle bg-secondary-background p-6"
    >
      <h2 class="m-0 text-base font-semibold text-base-foreground">
        {{ t('checkout.noPlanTitle') }}
      </h2>
      <p class="mt-2 mb-0 text-sm text-muted-foreground">
        {{ t('checkout.noPlanBody') }}
      </p>
      <RouterLink
        :to="subscriptionPath"
        class="mt-4 inline-block text-sm text-base-foreground underline underline-offset-4"
      >
        {{ t('checkout.choosePlan') }}
      </RouterLink>
    </section>
  </HostedSurface>

  <main
    v-else
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <section class="mx-auto flex min-h-full max-w-7xl items-center">
      <p v-if="quoting" class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.loading') }}
      </p>
      <section
        v-else-if="failure"
        class="rounded-xl border border-border-subtle bg-secondary-background p-6"
      >
        <p class="m-0 text-sm text-destructive-background">
          {{ coded('failure', failure.code) }}
        </p>
        <button
          type="button"
          class="mt-4 cursor-pointer text-sm text-base-foreground underline underline-offset-4"
          @click="back"
        >
          {{ t('checkout.back') }}
        </button>
      </section>
      <EmbeddedCheckout
        v-else-if="summary"
        v-bind="summary"
        :phase="phase"
        @back="back"
        @close="close"
      >
        <template #form>
          <CheckoutSteps
            v-if="checkout.operation.value"
            :projection="checkout.projection.value"
            root-class="flex flex-col gap-3"
            header-class="m-0 text-base font-semibold text-base-foreground"
            body-class="m-0 text-sm text-muted-foreground"
            reason-class="m-0 text-sm text-destructive-background"
            safety-class="m-0 text-sm text-muted-foreground"
            actions-class="mt-2 flex gap-2"
            action-class="h-11 cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background"
            @retry="checkout.reset()"
            @cancel="checkout.cancel()"
            @continue-verification="checkout.continueVerification()"
          />
          <StripePaymentForm
            v-else
            :publishable-key="publishableKey"
            :amount-cents="amountCents"
            :currency="currency"
            :copy="paymentCopy"
            :payment-method-configuration-id="paymentMethodConfigurationId"
            :is-loading="checkout.submitting.value"
            :can-submit="canSubmit"
            @confirm="confirm"
          >
            <template #submit="{ disabled, loading: submitting }">
              <CheckoutSubmit
                v-model:confirmed="reactivationConfirmed"
                :amount-cents="amountCents"
                :disabled="disabled"
                :submitting="submitting"
                :reactivation-required="reactivationRequired"
                :failure="submitFailure"
              />
            </template>
          </StripePaymentForm>
        </template>
        <template #done>
          <a
            v-if="returnLink"
            :href="returnLink"
            class="mt-10 flex h-12 w-full items-center justify-center rounded-lg bg-base-foreground px-5 font-semibold text-base-background"
          >
            {{ t('checkout.returnToProduct', { product: productName }) }}
          </a>
        </template>
      </EmbeddedCheckout>
    </section>
  </main>
</template>
