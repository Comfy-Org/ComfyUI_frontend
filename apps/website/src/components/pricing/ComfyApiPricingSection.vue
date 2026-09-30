<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import PlatformPricingSection from '../../templates/platform/PricingSection.vue'
import SectionHeader from '../common/SectionHeader.vue'
import ComfyApiPlanLimitsSection from './ComfyApiPlanLimitsSection.vue'

const { locale = 'en', showLearnMoreCta = false } = defineProps<{
  locale?: Locale
  /** Link to the dedicated Comfy API page — omit on that page itself. */
  showLearnMoreCta?: boolean
}>()

const learnMoreHref = computed(() => getRoutes(locale).platformComfyApi)
</script>

<template>
  <section
    id="pricing"
    class="mx-auto max-w-9xl scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <SectionHeader max-width="xl" heading-size="subsection">
      {{ t('pricing.comfyApi.heading', {}, { locale: locale }) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('pricing.comfyApi.subtitle', {}, { locale: locale }) }}
        </p>
        <p v-if="showLearnMoreCta" class="mt-4 text-sm">
          <a
            :href="learnMoreHref"
            class="rounded-sm text-primary-comfy-canvas underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          >
            {{ t('pricing.comfyApi.learnMore', {}, { locale: locale }) }}
          </a>
        </p>
      </template>
    </SectionHeader>

    <PlatformPricingSection :locale="locale" bare />
    <ComfyApiPlanLimitsSection :locale="locale" bare class="mt-12" />
  </section>
</template>
