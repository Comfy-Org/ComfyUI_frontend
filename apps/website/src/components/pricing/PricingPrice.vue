<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { computed } from 'vue'

import { t } from '../../i18n/translations'

const {
  locale = 'en',
  billingPeriod,
  yearlyTotal
} = defineProps<{
  price: string
  period: string
  originalPrice?: string
  discount?: string
  billingPeriod?: 'monthly' | 'yearly'
  yearlyTotal?: string
  locale?: Locale
}>()

const billingNote = computed(() => {
  if (billingPeriod === 'yearly' && yearlyTotal) {
    return t('pricing.period.billedYearly', locale).replace(
      '{total}',
      yearlyTotal
    )
  }
  if (billingPeriod === 'monthly') {
    return t('pricing.period.billedMonthly', locale)
  }
  return undefined
})
</script>

<template>
  <div>
    <div class="mt-6 flex items-baseline gap-2">
      <span class="font-formula text-5xl font-light text-primary-comfy-canvas">
        {{ price }}
      </span>
      <div class="flex gap-2 max-sm:flex-col">
        <div class="flex items-baseline gap-2">
          <span
            v-if="originalPrice"
            class="font-formula text-primary-warm-gray text-sm font-light line-through"
          >
            {{ originalPrice }}
          </span>
          <span class="text-primary-warm-white text-sm">
            {{ period }}
          </span>
        </div>

        <span
          v-if="discount"
          class="text-primary-comfy-yellow text-sm max-sm:text-xs sm:ml-2"
        >
          {{ discount }}
        </span>
      </div>
    </div>
    <p v-if="billingNote" class="text-primary-warm-gray mt-2 text-sm">
      {{ billingNote }}
    </p>
  </div>
</template>
