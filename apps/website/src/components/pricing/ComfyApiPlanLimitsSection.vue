<script setup lang="ts">
import type { ComfyApiPlanLimits } from '@/data/comfyApiPlanLimits'
import type { Locale } from '@/i18n/translations'
import type { PlanLimitMetric } from './PlanLimitsTable.vue'
import { computed } from 'vue'

import SectionHeader from '@/components/common/SectionHeader.vue'
import { getRoutes } from '@/config/routes'
import { comfyApiPlanLimits } from '@/data/comfyApiPlanLimits'
import { translationsFor } from '@/i18n/translations'
import PlanLimitsTable from './PlanLimitsTable.vue'

const { locale = 'en', bare = false } = defineProps<{
  locale?: Locale
  /** Render the table alone, with no section wrapper or heading — for embedding inside another section. */
  bare?: boolean
}>()
const { t } = translationsFor(locale)

const contactHref = computed(() => getRoutes(locale).contact)

const metrics: PlanLimitMetric<ComfyApiPlanLimits>[] = [
  {
    labelKey: 'pricing.comfyApi.metric.releases',
    format: (plan) => plan.totalReleasesLimit
  },
  {
    labelKey: 'pricing.comfyApi.metric.deployments',
    format: (plan) => plan.totalDeploymentsLimit
  },
  {
    labelKey: 'pricing.comfyApi.metric.concurrency',
    format: (plan) => plan.maxWorkerConcurrency
  }
]
</script>

<template>
  <component
    :is="bare ? 'div' : 'section'"
    :class="
      bare ? 'mx-auto max-w-9xl' : 'mx-auto max-w-9xl px-6 py-10 lg:py-14'
    "
  >
    <SectionHeader v-if="!bare" max-width="xl" heading-size="subsection">
      {{ t('pricing.comfyApi.heading') }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('pricing.comfyApi.subtitle') }}
        </p>
      </template>
    </SectionHeader>

    <PlanLimitsTable :plans="comfyApiPlanLimits" :metrics :locale />

    <p class="mt-4 px-2 text-center text-xs text-primary-warm-gray">
      {{ t('pricing.comfyApi.enterpriseNote') }}
      <a
        :href="contactHref"
        class="rounded-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      >
        {{ t('pricing.enterprise.cta') }}
      </a>
    </p>
  </component>
</template>
