<template>
  <div
    :class="cn('flex flex-col gap-4 px-4 pt-1 pb-3', className)"
    data-testid="credits-breakdown"
  >
    <div v-if="state.kind !== 'noPlan'" class="flex flex-col gap-2 pt-2">
      <div class="flex items-start justify-between gap-2 text-sm">
        <span class="text-muted-foreground">{{ copy.planCredits }}</span>
        <div v-if="loading" :class="cn(SKELETON, 'w-18')" />
        <span
          v-else
          class="text-muted-foreground tabular-nums"
          data-testid="credits-breakdown-plan"
          >{{ planLine.before
          }}<span class="font-semibold text-foreground">{{
            planLine.value
          }}</span
          >{{ planLine.after }}</span
        >
      </div>
      <div
        v-if="loading || usedPercent !== null"
        v-bind="meterAttrs"
        class="h-1 overflow-hidden rounded-full bg-accent"
      >
        <div
          class="h-full rounded-full bg-foreground"
          :style="{ width: `${usedPercent ?? 0}%` }"
        />
      </div>
      <p
        v-if="planNote"
        :role="state.kind === 'unavailable' ? 'alert' : undefined"
        class="m-0 text-xs text-muted-foreground"
        data-testid="credits-breakdown-plan-note"
      >
        {{ planNote }}
      </p>
    </div>
    <div class="flex flex-col gap-2 pt-2">
      <div class="flex items-start justify-between gap-2 text-sm">
        <span class="text-muted-foreground">{{ copy.topUpCredits }}</span>
        <div v-if="loading" :class="cn(SKELETON, 'w-10')" />
        <span
          v-else
          class="font-semibold text-foreground tabular-nums"
          data-testid="credits-breakdown-top-up"
        >
          {{ topUp }}
        </span>
      </div>
      <slot name="topUpNote" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { CreditsFlyoutState } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import {
  centsToCredits,
  formatWholeCredits,
  planDateLine,
  planUsedPercent,
  splitPlanOfPool
} from './creditsCardCopy'
import type { CreditsBreakdownCopy } from './creditsCardCopy'

const {
  state,
  copy,
  locale,
  class: className
} = defineProps<{
  state: CreditsFlyoutState
  copy: CreditsBreakdownCopy
  locale: string
  class?: HTMLAttributes['class']
}>()

// shortcut: design-system Skeleton's classes inline; a new account-ui SFC importing
// any design-system .vue fails the packages vue-tsc -b build (TS2307). Swap back once that resolves.
const SKELETON = 'h-3 animate-pulse rounded-sm bg-secondary'

const loading = computed(() => state.kind === 'loading')
const plan = computed(() => (state.kind === 'plan' ? state : null))

const credits = (cents: number) =>
  formatWholeCredits(centsToCredits(cents), locale)

// Without a served plan total there is no "of {total}" and no bar.
const planLine = computed(() => {
  if (!plan.value) return { before: '', value: '—', after: '' }
  const value = credits(plan.value.planCents)
  const total = plan.value.planPoolCredits
  if (!total) return { before: '', value, after: '' }
  return {
    ...splitPlanOfPool(copy.planOfPool, formatWholeCredits(total, locale)),
    value
  }
})

const usedPercent = computed(() =>
  plan.value ? planUsedPercent(plan.value) : null
)

const meterAttrs = computed<HTMLAttributes>(() =>
  usedPercent.value === null
    ? { 'aria-hidden': true }
    : {
        role: 'meter',
        'aria-label': copy.planCredits,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': usedPercent.value
      }
)

const planNote = computed(() => {
  if (state.kind === 'unavailable') return copy.unavailable
  return plan.value
    ? planDateLine(plan.value, copy, locale, plan.value.cadence)
    : ''
})

const topUp = computed(() =>
  state.kind === 'plan' || state.kind === 'noPlan'
    ? credits(state.topUpCents)
    : '—'
)
</script>
