<script setup lang="ts">
import { translationsFor } from '../../../i18n/translations'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import { formatCreditRange } from '../../../lib/workshop/cinematic-studio/estimate'
import type { Locale } from '../../../i18n/translations'

const {
  estimate,
  wide = false,
  locale = 'en'
} = defineProps<{
  estimate?: ShotEstimate
  wide?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

function perTake(shot: ShotEstimate): string | undefined {
  if (shot.takes === 1) return undefined
  return t('cinematic.credits.perTake', {
    takes: shot.takes,
    credits: formatCreditRange(shot.perTake, locale)
  })
}

const cost = computed(() =>
  estimate
    ? {
        label: t('cinematic.credits.estimate', {
          credits: formatCreditRange(estimate.total, locale)
        }),
        detail: perTake(estimate)
      }
    : {
        label: t('cinematic.credits.varies'),
        hint: t('cinematic.credits.variesHint')
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
