<template>
  <div
    class="mx-auto flex h-full min-h-0 max-w-[400px] flex-col justify-between overflow-y-auto text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col items-center gap-4 pt-8">
      <i class="pi pi-check-circle text-5xl text-success" />
      <CheckoutTitle
        class="m-0 text-center text-xl font-semibold text-foreground lg:text-2xl"
      >
        {{ copy.allSet }}
      </CheckoutTitle>
      <p class="m-0 text-center text-muted-foreground">
        {{ copy.planUpdated }}
        {{ copy.receiptEmailed }}
      </p>

      <slot v-if="planReplaced" name="plan" />
      <template v-else>
        <div
          :class="
            cn(
              'mt-4 flex w-full flex-col gap-1 rounded-xl border bg-background p-4',
              darkSurface && 'border-none bg-secondary'
            )
          "
        >
          <span class="text-foreground">{{ plan.name }}</span>
          <div class="flex items-baseline gap-1 text-foreground">
            <span class="text-2xl font-semibold tabular-nums">
              ${{ displayPrice }}
            </span>
            <span>
              {{ isYearly ? copy.usdPerYear : copy.usdPerMonth }}
            </span>
          </div>
          <div class="flex items-center gap-1 text-muted-foreground">
            <i class="icon-[lucide--coins] shrink-0 bg-credit" />
            <span class="tabular-nums">
              {{ displayCredits }} {{ isYearly ? copy.perYear : copy.perMonth }}
            </span>
          </div>
        </div>

        <p
          v-if="promoApplied"
          class="m-0 text-center text-muted-foreground tabular-nums"
        >
          <span class="font-medium text-foreground">
            {{ copy.promoApplied(promoApplied.code) }}
          </span>
          {{
            copy.promoRenews(
              promoApplied.renewalAmount,
              promoApplied.renewalDate
            )
          }}
        </p>
      </template>

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
 * action, and names a plan it did not quote here through the `plan` slot and
 * `planReplaced`.
 */
import { computed } from 'vue'

import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from './CheckoutButton.vue'
import CheckoutTitle from './CheckoutTitle.vue'
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
  closeDemoted = false,
  planReplaced = false
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
  /** The host names a plan it did not quote here in the `plan` slot. */
  planReplaced?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan?.duration, billingCycle)
)

const displayPrice = computed(() => {
  if (previewData?.new_plan) {
    const amountUsd = previewData.new_plan.price_cents / 100
    const keepCents =
      !plan.pricedByQuote && isYearly.value && !Number.isInteger(amountUsd)
    return keepCents ? amountUsd.toFixed(2) : amountUsd.toFixed(0)
  }
  if (plan.pricedByQuote) return '0'
  return String(
    isYearly.value
      ? (plan.yearlyChargeUsd ?? plan.monthlyPriceUsd.yearly * 12)
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
