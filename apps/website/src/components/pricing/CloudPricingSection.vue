<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import PricingSection from './PricingSection.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <PricingSection :locale>
    <template #banner>
      <div
        class="bg-transparency-white-t4 rounded-5xl mb-4 flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-lg font-bold text-primary-comfy-canvas">
            {{ t('pricing.freeTrialBanner.title', locale) }}
          </p>
          <p class="mt-1 text-sm text-primary-comfy-canvas">
            {{ t('pricing.freeTrialBanner.subtitle', locale) }}
          </p>
        </div>
        <Button
          :href="externalLinks.cloud"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          class="w-full sm:w-auto sm:shrink-0"
        >
          {{ t('pricing.freeTrialBanner.cta', locale) }}
        </Button>
      </div>
    </template>
  </PricingSection>
</template>
