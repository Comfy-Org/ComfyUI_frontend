<template>
  <div
    class="mx-auto flex h-full min-h-0 max-w-[400px] flex-col items-stretch justify-between overflow-y-auto text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col items-center gap-4 pt-8">
      <i class="pi pi-check-circle text-5xl text-success-background" />
      <h2
        class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
      >
        {{ copy.allSet }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{ copy.planUpdated }}
        {{ copy.receiptEmailed }}
      </p>

      <div
        :class="
          cn(
            'mt-4 flex w-full flex-col gap-1 rounded-xl border border-border-default bg-base-background p-4',
            darkSurface && 'border-none bg-secondary-background'
          )
        "
      >
        <span class="text-sm text-base-foreground">{{ plan.name }}</span>
        <div class="flex items-baseline gap-1">
          <span
            class="text-2xl font-semibold text-base-foreground tabular-nums"
          >
            ${{ displayPrice }}
          </span>
          <span class="text-sm text-base-foreground">
            {{ isYearly ? copy.usdPerYear : copy.usdPerMonth }}
          </span>
        </div>
        <div class="flex items-center gap-1 text-sm text-muted-foreground">
          <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
          <span class="tabular-nums">
            {{ displayCredits }} {{ isYearly ? copy.perYear : copy.perMonth }}
          </span>
        </div>
      </div>

      <p
        v-if="promoApplied"
        class="m-0 text-center text-sm text-muted-foreground tabular-nums"
      >
        <span class="font-medium text-base-foreground">
          {{ copy.promoApplied(promoApplied.code) }}
        </span>
        {{
          copy.promoRenews(promoApplied.renewalAmount, promoApplied.renewalDate)
        }}
      </p>

      <slot name="details" />
    </div>

    <div class="flex flex-col gap-2 pt-8 pb-4">
      <slot name="actions" />
      <CheckoutButton
        :variant="closeDemoted ? 'muted-textonly' : 'secondary'"
        size="lg"
        class="w-full rounded-lg"
        @click="emit('close')"
      >
        {{ copy.close }}
      </CheckoutButton>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The step after a successful subscribe: what the customer now has. A host
 * adds its own follow-up (the cloud app's team invite) through the
 * `details` and `actions` slots, demoting Close when it leads with another
 * action.
 */
import { computed } from 'vue'

import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from './CheckoutButton.vue'
import type { CheckoutSuccessCopy } from './checkoutCopy'
import type { CheckoutBillingCycle, CheckoutPlan } from './checkoutQuote'
import { formatNumber, isYearlyCheckout } from './checkoutQuote'

const {
  plan,
  copy,
  locale,
  previewData = null,
  billingCycle = 'monthly',
  darkSurface = false,
  promoApplied = null,
  closeDemoted = false
} = defineProps<{
  plan: CheckoutPlan
  copy: CheckoutSuccessCopy
  locale: string
  previewData?: SubscriptionPreview | null
  billingCycle?: CheckoutBillingCycle
  /** The surface paints base-background; the plan card elevates to stay
   *  visible. */
  darkSurface?: boolean
  /** Applied promotion feedback (Figma 5379-30077 S3), display-ready. */
  promoApplied?: {
    code: string
    renewalAmount: string
    renewalDate: string
  } | null
  closeDemoted?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan?.duration, billingCycle)
)

const displayPrice = computed(() => {
  if (previewData?.new_plan) {
    return (previewData.new_plan.price_cents / 100).toFixed(0)
  }
  if (plan.pricedByQuote) return '0'
  return String(
    isYearly.value
      ? plan.monthlyPriceUsd.yearly * 12
      : plan.monthlyPriceUsd.monthly
  )
})

const displayCredits = computed(() =>
  formatNumber(
    isYearly.value ? plan.monthlyCredits * 12 : plan.monthlyCredits,
    locale
  )
)
</script>
