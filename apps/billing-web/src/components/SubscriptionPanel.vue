<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BillingStatusData } from '@comfyorg/account-core/billing'
import { useBillingClient, usePlans } from '@comfyorg/account-ui/billing'

import SubscriptionActions from '@/components/SubscriptionActions.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'

const { t } = useI18n()
const { coded, date } = useHostedCopy()
const { plans, loading, failure, refresh } = usePlans()

const { status } = useBillingClient<'status'>(undefined)

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

const currentName = computed(() => {
  const catalog = plans.value
  const current = catalog?.plans.find(
    (plan) => plan.slug === catalog.current_plan_slug
  )
  return current
    ? t('hosted.plan.name', {
        tier: coded('tier', current.tier),
        duration: coded('duration', current.duration)
      })
    : undefined
})
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
  </section>
</template>
