<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BillingPlansData } from '@comfyorg/account-core/billing'
import { usePlans, usePreviewSubscribe } from '@comfyorg/account-ui/billing'

import PlanCard from '@/components/PlanCard.vue'
import SubscriptionQuote from '@/components/SubscriptionQuote.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'

type CatalogPlan = BillingPlansData['plans'][number]

const { t } = useI18n()
const { coded, money } = useHostedCopy()
const { plans, loading, failure } = usePlans()
const {
  preview,
  loading: quoting,
  failure: quoteFailure,
  quote
} = usePreviewSubscribe()

const selectedSlug = ref<string | undefined>()

const currentSlug = computed(() => plans.value?.current_plan_slug)

function planCard(plan: CatalogPlan) {
  const seats = Number(plan.max_seats)
  return {
    slug: plan.slug,
    props: {
      name: t('hosted.plan.name', {
        tier: coded('tier', plan.tier),
        duration: coded('duration', plan.duration)
      }),
      price: money(plan.price_cents),
      credits: t('hosted.plan.credits', { amount: money(plan.credits_cents) }),
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

async function selectPlan(slug: string) {
  selectedSlug.value = slug
  await quote({ planSlug: slug })
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

    <ul class="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
      <PlanCard
        v-for="card in cards"
        :key="card.slug"
        v-bind="card.props"
        @choose="selectPlan(card.slug)"
      />
    </ul>

    <SubscriptionQuote
      v-if="selectedSlug"
      :preview="preview"
      :loading="quoting"
      :failure-code="quoteFailure?.code"
    />
  </section>
</template>
