<script setup lang="ts">
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import PricingCard from './PricingCard.vue'
import PricingPlanLabel from './PricingPlanLabel.vue'

const {
  locale = 'en',
  href,
  ctaKey = 'pricing.enterprise.cta'
} = defineProps<{
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  locale?: Locale
  href?: string
  ctaKey?: TranslationKey
}>()

const ctaHref = computed(() => href ?? getRoutes(locale).contact)
const isExternalHref = computed(() => Boolean(href?.startsWith('http')))
</script>

<template>
  <PricingCard class="col-span-full">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-20">
      <div
        class="flex flex-col gap-6 lg:col-span-2 lg:flex-row lg:items-center"
      >
        <PricingPlanLabel :label="t(labelKey, locale)" />
        <p class="text-primary-warm-white">
          {{ t(descriptionKey, locale) }}
        </p>
      </div>
      <Button
        :href="ctaHref"
        :target="isExternalHref ? '_blank' : undefined"
        :rel="isExternalHref ? 'noopener noreferrer' : undefined"
        variant="outline"
      >
        {{ t(ctaKey, locale) }}
      </Button>
    </div>
  </PricingCard>
</template>
