<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import PricingCard from './PricingCard.vue'
import PricingPlanLabel from './PricingPlanLabel.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const ctaHref = computed(() => getRoutes(locale).cloudEnterprise)
</script>

<template>
  <PricingCard class="col-span-full">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-20">
      <div
        class="flex flex-col gap-6 lg:col-span-2 lg:flex-row lg:items-center"
      >
        <PricingPlanLabel :label="t('pricing.enterprise.label', locale)" />
        <p class="text-primary-warm-white text-sm">
          {{ t('pricing.enterprise.description', locale) }}
        </p>
      </div>
      <Button :href="ctaHref" variant="outline">
        {{ t('pricing.enterprise.cta', locale) }}
      </Button>
    </div>
  </PricingCard>
</template>
