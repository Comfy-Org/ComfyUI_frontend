<script setup lang="ts">
import type { Locale, TranslationKey } from '@/i18n/translations'
import { computed } from 'vue'

import { getRoutes } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'
import Button from '@/components/ui/button/Button.vue'
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
const { t } = translationsFor(locale)

const ctaHref = computed(() => href ?? getRoutes(locale).contact)
const isExternalHref = computed(() => Boolean(href?.startsWith('http')))
</script>

<template>
  <PricingCard class="col-span-full">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-20">
      <div
        class="flex flex-col gap-6 lg:col-span-2 lg:flex-row lg:items-center"
      >
        <PricingPlanLabel :label="t(labelKey)" />
        <p class="text-primary-warm-white">
          {{ t(descriptionKey) }}
        </p>
      </div>
      <Button
        data-testid="enterprise-cta"
        :href="ctaHref"
        :target="isExternalHref ? '_blank' : undefined"
        :rel="isExternalHref ? 'noopener noreferrer' : undefined"
        variant="outline"
      >
        {{ t(ctaKey) }}
      </Button>
    </div>
  </PricingCard>
</template>
