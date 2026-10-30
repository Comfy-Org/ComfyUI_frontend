<template>
  <div class="flex flex-1 flex-col gap-2 border-r border-border px-5 py-4">
    <span class="flex items-center gap-1 text-sm text-muted-foreground">
      {{ $t('workspacePanel.billingTab.credits.plan') }}
      <BillingInfoTip
        :text="$t('workspacePanel.billingTab.credits.planTooltip')"
      />
    </span>
    <i18n-t
      v-if="planTotal"
      keypath="workspacePanel.billingTab.credits.planOfPool"
      tag="span"
      class="text-sm text-muted-foreground"
      data-testid="billing-credits-plan"
    >
      <template #remaining>
        <span class="font-semibold text-foreground">
          {{ credits(plan.planCents) }}
        </span>
      </template>
      <template #total>{{ planTotal }}</template>
    </i18n-t>
    <span
      v-else
      class="text-sm font-semibold text-foreground"
      data-testid="billing-credits-plan"
    >
      {{ credits(plan.planCents) }}
    </span>
    <div
      v-if="planDateLine || planUsedPercent !== null"
      class="flex flex-col gap-2 pt-2"
    >
      <div
        class="flex items-center justify-between gap-2 text-sm text-muted-foreground"
      >
        <span data-testid="billing-credits-plan-date">
          {{ planDateLine }}
        </span>
        <span
          v-if="planUsedPercent !== null"
          data-testid="billing-credits-plan-used"
        >
          {{
            $t('workspacePanel.billingTab.credits.planUsed', {
              percent: planUsedPercent
            })
          }}
        </span>
      </div>
      <div
        v-if="planUsedPercent !== null"
        role="meter"
        :aria-label="$t('workspacePanel.billingTab.credits.plan')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="planUsedPercent"
        class="h-1 overflow-hidden rounded-full bg-accent"
      >
        <div
          class="h-full rounded-full bg-foreground"
          :style="{ width: `${planUsedPercent}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clamp } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  formatCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import BillingInfoTip from '@/platform/billing/components/billingTab/BillingInfoTip.vue'
import type { PlanCreditsState } from '@/platform/billing/components/billingTab/creditsCard'
import { useLongDate } from '@/platform/billing/composables/useLongDate'

const { plan } = defineProps<{ plan: PlanCreditsState }>()

const { t, locale } = useI18n()
const { longDate } = useLongDate()

const WHOLE = { maximumFractionDigits: 0 }

const PLAN_DATE_KEY = {
  refills: 'subscription.refillsDate',
  availableUntil: 'workspacePanel.billingTab.credits.availableUntil'
} as const

function credits(cents: number) {
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: WHOLE
  })
}

const planTotal = computed(() =>
  plan.planPoolCredits
    ? formatCredits({
        value: plan.planPoolCredits,
        locale: locale.value,
        numberOptions: WHOLE
      })
    : null
)

const planUsedPercent = computed(() => {
  if (!plan.showUsage || !plan.planPoolCredits) return null
  const remaining = centsToCredits(plan.planCents) / plan.planPoolCredits
  return Math.round(clamp(1 - remaining, 0, 1) * 100)
})

const planDateLine = computed(() => {
  if (plan.planDate.kind === 'afterPayment')
    return t('subscription.refillsAfterPayment')
  const date = longDate(plan.planDate.date)
  return date ? t(PLAN_DATE_KEY[plan.planDate.kind], { date }) : ''
})
</script>
