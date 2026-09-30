<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import { formatCreditRange } from '../../../lib/workshop/cinematic-studio/estimate'
import type { Locale } from '../../../i18n/translations'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  estimate,
  wide = false,
  locale = 'en'
} = defineProps<{
  estimate?: ShotEstimate
  wide?: boolean
  locale?: Locale
}>()

function perTake(shot: ShotEstimate): string | undefined {
  if (shot.takes === 1) return undefined
  return tc(
    'cinematic.credits.perTake',
    {
      takes: shot.takes,
      credits: formatCreditRange(shot.perTake, locale)
    },
    { locale }
  )
}

const cost = computed(() =>
  estimate
    ? {
        label: tc(
          'cinematic.credits.estimate',
          {
            credits: formatCreditRange(estimate.total, locale)
          },
          { locale }
        ),
        detail: perTake(estimate)
      }
    : {
        label: tc('cinematic.credits.varies', {}, { locale }),
        hint: tc('cinematic.credits.variesHint', {}, { locale })
      }
)
</script>

<template>
  <span
    data-testid="cinematic-estimate"
    :title="cost.hint"
    :class="
      cn('flex flex-col leading-tight', wide ? 'items-center' : 'items-end')
    "
  >
    <span class="text-xs text-primary-warm-white">{{ cost.label }}</span>
    <span v-if="cost.detail" class="text-[11px] text-primary-warm-gray">
      {{ cost.detail }}
    </span>
  </span>
</template>
