<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import PricingCard from './PricingCard.vue'
import PricingPlanLabel from './PricingPlanLabel.vue'

const { locale = 'en', education = false } = defineProps<{
  locale?: Locale
  education?: boolean
}>()

const ctaHref = computed(() => getRoutes(locale).contact)

const labelKey = education
  ? 'pricing.creativeCampus.label'
  : 'pricing.enterprise.label'
const descriptionKey = education
  ? 'pricing.creativeCampus.description'
  : 'pricing.enterprise.description'
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
      <Button :href="ctaHref" variant="outline">
        {{ t('pricing.enterprise.cta', locale) }}
      </Button>
    </div>
  </PricingCard>
</template>
