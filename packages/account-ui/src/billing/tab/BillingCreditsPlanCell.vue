<template>
  <div
    :class="
      cn(
        'flex flex-1 flex-col gap-2 border-r border-card px-5 py-4',
        classes?.root
      )
    "
  >
    <span class="flex items-center gap-1 text-sm text-muted-foreground">
      {{ copy.plan }}
      <TextTooltip :text="copy.planTooltip">
        <CheckoutButton
          :aria-label="copy.planTooltip"
          variant="muted-textonly"
          size="icon-sm"
        >
          <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
        </CheckoutButton>
      </TextTooltip>
    </span>
    <span
      v-if="planOfPool"
      class="text-sm text-muted-foreground"
      data-testid="billing-credits-plan"
    >
      {{ planOfPool.before
      }}<span class="font-semibold text-foreground">{{ remaining }}</span
      >{{ planOfPool.after }}
    </span>
    <span
      v-else
      class="text-sm font-semibold text-foreground"
      data-testid="billing-credits-plan"
    >
      {{ remaining }}
    </span>
    <div
      v-if="dateLine || usedPercent !== null"
      class="flex flex-col gap-2 pt-2"
    >
      <div
        class="flex items-center justify-between gap-2 text-sm text-muted-foreground"
      >
        <span data-testid="billing-credits-plan-date">{{ dateLine }}</span>
        <span
          v-if="usedPercent !== null"
          data-testid="billing-credits-plan-used"
        >
          {{ copy.planUsed(usedPercent) }}
        </span>
      </div>
      <div
        v-if="usedPercent !== null"
        role="meter"
        :aria-label="copy.plan"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="usedPercent"
        :class="
          cn('h-1 overflow-hidden rounded-full bg-accent', classes?.meter)
        "
      >
        <div
          class="h-full rounded-full bg-foreground"
          :style="{ width: `${usedPercent}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The plan pool of the Credits card: remaining of total, refill date, usage.
 */
import { computed } from 'vue'

import type { PlanCreditsState } from '@comfyorg/account-core/billing'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

import {
  centsToCredits,
  formatWholeCredits,
  planDateLine,
  planUsedPercent,
  splitPlanOfPool
} from './creditsCardCopy'
import type { CreditsCardCopy } from './creditsCardCopy'

const { plan, copy, locale, classes } = defineProps<{
  plan: PlanCreditsState
  copy: CreditsCardCopy
  locale: string
  classes?: Partial<Record<'root' | 'meter', string>>
}>()

const remaining = computed(() =>
  formatWholeCredits(centsToCredits(plan.planCents), locale)
)

const planOfPool = computed(() =>
  plan.planPoolCredits
    ? splitPlanOfPool(
        copy.planOfPool,
        formatWholeCredits(plan.planPoolCredits, locale)
      )
    : null
)

const usedPercent = computed(() => planUsedPercent(plan))

const dateLine = computed(() => planDateLine(plan, copy, locale))
</script>
