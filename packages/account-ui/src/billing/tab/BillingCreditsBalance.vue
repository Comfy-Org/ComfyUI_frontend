<template>
  <div class="flex min-w-0 flex-col gap-2">
    <span class="text-sm text-muted-foreground">
      {{ copy.available }}
    </span>
    <span
      :class="
        cn(
          'text-2xl font-medium text-foreground',
          state.kind === 'unavailable' && 'text-muted-foreground',
          classes?.available
        )
      "
      data-testid="billing-credits-available"
    >
      {{ available }}
    </span>
    <p
      v-if="state.kind === 'unavailable'"
      :class="
        cn(
          'm-0 flex items-center gap-1 text-sm text-muted-foreground',
          classes?.note
        )
      "
      role="alert"
    >
      {{ copy.unavailable }}
      <slot name="retry" :label="copy.tryAgain">
        <CheckoutButton variant="link" size="sm" @click="emit('retry')">
          {{ copy.tryAgain }}
        </CheckoutButton>
      </slot>
    </p>
    <p
      v-else-if="overdrawnLine"
      :class="cn('m-0 text-sm text-muted-foreground', classes?.note)"
    >
      {{ overdrawnLine }}
    </p>
    <p
      v-if="planCreditNote"
      :class="cn('m-0 text-sm text-muted-foreground', classes?.note)"
      data-testid="billing-credits-plan-note"
    >
      {{ planCreditNote }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { CreditsCardState } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

import { centsToCredits, formatWholeCredits } from './creditsCardCopy'
import type { CreditsCardCopy } from './creditsCardCopy'

const { state, planCreditNote, copy, locale, classes } = defineProps<{
  state: CreditsCardState
  planCreditNote: string | null
  copy: CreditsCardCopy
  locale: string
  classes?: Partial<Record<'available' | 'note', string>>
}>()

const emit = defineEmits<{ retry: [] }>()

const available = computed(() =>
  state.kind === 'unavailable'
    ? '—'
    : formatWholeCredits(centsToCredits(state.availableCents), locale)
)

const overdrawnLine = computed(() => {
  if (state.kind === 'unavailable') return null
  const overdrawn = centsToCredits(-state.availableCents)
  return overdrawn > 0
    ? copy.overdrawn(formatWholeCredits(overdrawn, locale), overdrawn)
    : null
})
</script>
