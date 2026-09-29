<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlatformPricingSection from '../../templates/platform/PricingSection.vue'
import SectionHeader from '../common/SectionHeader.vue'
import ComfyApiPlanLimitsSection from './ComfyApiPlanLimitsSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    id="pricing"
    class="mx-auto max-w-9xl scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <SectionHeader max-width="xl" heading-size="subsection">
      {{ t('pricing.comfyApi.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('pricing.comfyApi.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <PlatformPricingSection :locale="locale" bare />
    <ComfyApiPlanLimitsSection :locale="locale" bare class="mt-12" />
  </section>
</template>
