<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type {
  BillingPlansData,
  BillingStatusData
} from '@comfyorg/account-core/billing'
import {
  useBillingClient,
  usePlans,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import { billingIntentPath } from '@comfyorg/billing-contract'

import PlanCard from '@/components/PlanCard.vue'
import SubscriptionActions from '@/components/SubscriptionActions.vue'
import SubscriptionQuote from '@/components/SubscriptionQuote.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'

type CatalogPlan = BillingPlansData['plans'][number]
type CreditStop = NonNullable<
  BillingPlansData['team_credit_stops']
>['stops'][number]

const { t, n } = useI18n()
const { coded, date, money } = useHostedCopy()
const route = useRoute()
const router = useRouter()
const { plans, loading, failure, refresh } = usePlans()
const {
  preview,
  loading: quoting,
  failure: quoteFailure,
  quote
} = usePreviewSubscribe()

const { status } = useBillingClient<'status'>(undefined)

const selectedSlug = ref<string | undefined>()
const quotedStopId = ref<string | undefined>()
const chosenStopId = ref<string | undefined>()
const billingStatus = ref<BillingStatusData | undefined>()

async function readStatus() {
  const result = await status.read()
  billingStatus.value = result.status === 'ok' ? result.value.status : undefined
}

onMounted(() => void readStatus())

async function subscriptionChanged() {
  await Promise.all([refresh(), readStatus()])
}

const endsAt = computed(() => billingStatus.value?.cancel_at)

const creditStops = computed(() => plans.value?.team_credit_stops)

/** The customer's pick, else the workspace's subscribed stop, else the server's default. */
const activeStop = computed<CreditStop | undefined>(() => {
  const ladder = creditStops.value
  if (ladder === undefined) return undefined
  const byId = (id: string | undefined) =>
    ladder.stops.find((stop) => stop.id === id)
  return (
    byId(chosenStopId.value) ??
    byId(billingStatus.value?.team_credit_stop?.id) ??
    ladder.stops[ladder.default_stop_index]
  )
})

function stopPrice(plan: CatalogPlan, stop: CreditStop) {
  return money(
    plan.duration === 'ANNUAL'
      ? stop.yearly.price_cents
      : stop.monthly.price_cents
  )
}

function stopCredits(stop: CreditStop) {
  return t('hosted.plan.stopCredits', { credits: n(Number(stop.credits)) })
}

function stopPricing(plan: CatalogPlan, stop: CreditStop) {
  return {
    price: stopPrice(plan, stop),
    credits: stopCredits(stop),
    stopId: stop.id,
    stops: (creditStops.value?.stops ?? []).map((option) => ({
      id: option.id,
      label: t('hosted.plan.stopOption', {
        credits: stopCredits(option),
        price: stopPrice(plan, option)
      })
    }))
  }
}

function chooseStop(stopId: string | undefined) {
  chosenStopId.value = stopId
  selectedSlug.value = undefined
}

const currentSlug = computed(() => plans.value?.current_plan_slug)

function planCard(plan: CatalogPlan) {
  const seats = Number(plan.max_seats)
  // The catalog prices the Team tier by its credit-stop ladder, not `price_cents`.
  const stop = plan.tier === 'TEAM' ? activeStop.value : undefined
  return {
    slug: plan.slug,
    stopId: stop?.id,
    props: {
      name: t('hosted.plan.name', {
        tier: coded('tier', plan.tier),
        duration: coded('duration', plan.duration)
      }),
      ...(stop === undefined
        ? {
            price: money(plan.price_cents),
            credits: t('hosted.plan.credits', {
              amount: money(plan.credits_cents)
            })
          }
        : stopPricing(plan, stop)),
      seats: t('hosted.plan.seats', { count: seats }, seats),
      available: plan.availability.available,
      current: plan.slug === currentSlug.value,
      reason: plan.availability.available
        ? undefined
        : coded('availability', plan.availability.reason)
    }
  }
}

const cards = computed(() => (plans.value?.plans ?? []).map(planCard))
const currentName = computed(
  () => cards.value.find((card) => card.props.current)?.props.name
)

async function selectPlan(slug: string, stopId: string | undefined) {
  selectedSlug.value = slug
  quotedStopId.value = stopId
  await quote({
    planSlug: slug,
    ...(stopId === undefined ? {} : { teamCreditStopId: stopId })
  })
}

/** The entry's product and return target travel with the plan the customer chose. */
function goToCheckout() {
  if (selectedSlug.value === undefined) return
  void router.push({
    path: billingIntentPath('checkout'),
    query: {
      ...route.query,
      plan: selectedSlug.value,
      ...(quotedStopId.value === undefined
        ? {}
        : { team_credit_stop_id: quotedStopId.value })
    }
  })
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <p v-if="loading" class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.loading') }}
    </p>
    <p v-if="failure" class="m-0 text-sm text-destructive-background">
      {{ coded('failure', failure.code) }}
    </p>

    <p class="m-0 text-sm text-muted-foreground">
      {{
        currentName
          ? t('hosted.subscription.currentPlanIs', { plan: currentName })
          : t('hosted.subscription.noPlan')
      }}
    </p>
    <p v-if="endsAt" class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.subscription.endsOn', { date: date(endsAt) }) }}
    </p>

    <SubscriptionActions @changed="subscriptionChanged" />

    <ul class="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
      <PlanCard
        v-for="card in cards"
        :key="card.slug"
        v-bind="card.props"
        @choose="selectPlan(card.slug, card.stopId)"
        @update:stop-id="chooseStop"
      />
    </ul>

    <SubscriptionQuote
      v-if="selectedSlug"
      :preview="preview"
      :loading="quoting"
      :failure-code="quoteFailure?.code"
      @checkout="goToCheckout"
    />
  </section>
</template>
