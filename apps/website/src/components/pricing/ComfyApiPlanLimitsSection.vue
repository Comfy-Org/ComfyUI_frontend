<script setup lang="ts">
import type { Locale, TranslationKey } from '@/i18n/translations'
import { computed } from 'vue'

import SectionHeader from '@/components/common/SectionHeader.vue'
import { getRoutes } from '@/config/routes'
import { comfyApiPlanLimits } from '@/data/comfyApiPlanLimits'
import { translationsFor } from '@/i18n/translations'
import PricingPlanLabel from './PricingPlanLabel.vue'

const { locale = 'en', bare = false } = defineProps<{
  locale?: Locale
  /** Render the table alone, with no section wrapper or heading — for embedding inside another section. */
  bare?: boolean
}>()
const { t } = translationsFor(locale)

const contactHref = computed(() => getRoutes(locale).contact)

interface MetricRow {
  key: 'totalReleasesLimit' | 'totalDeploymentsLimit' | 'maxWorkerConcurrency'
  labelKey: TranslationKey
}

const metricRows: MetricRow[] = [
  { key: 'totalReleasesLimit', labelKey: 'pricing.comfyApi.metric.releases' },
  {
    key: 'totalDeploymentsLimit',
    labelKey: 'pricing.comfyApi.metric.deployments'
  },
  {
    key: 'maxWorkerConcurrency',
    labelKey: 'pricing.comfyApi.metric.concurrency'
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

    <div class="mx-auto mt-8 flex max-w-3xl flex-col gap-4 lg:hidden">
      <article
        v-for="plan in comfyApiPlanLimits"
        :key="plan.id"
        class="rounded-4xl bg-transparency-white-t4 px-5 py-6"
      >
        <PricingPlanLabel :label="t(plan.labelKey)" />
        <ul class="mt-5 space-y-4">
          <li
            v-for="metric in metricRows"
            :key="metric.key"
            class="flex items-center justify-between gap-4"
          >
            <p class="text-sm text-primary-warm-gray">
              {{ t(metric.labelKey) }}
            </p>
            <p class="font-mono text-sm text-primary-warm-white">
              {{ plan[metric.key] }}
            </p>
          </li>
        </ul>
      </article>
    </div>

    <div
      class="mx-auto mt-8 hidden max-w-6xl overflow-hidden rounded-4xl bg-transparency-white-t4 px-4 py-6 lg:block lg:px-8"
    >
      <div class="scrollbar-none overflow-x-auto">
        <table class="w-full min-w-160 text-left text-sm">
          <thead>
            <tr
              class="text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
            >
              <th class="px-2 py-4" scope="col">
                {{ t('pricing.comfyApi.metricColumn') }}
              </th>
              <th
                v-for="plan in comfyApiPlanLimits"
                :key="plan.id"
                class="p-4 text-right"
                scope="col"
              >
                {{ t(plan.labelKey) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in metricRows" :key="metric.key">
              <td class="max-w-72 px-2 py-3.5 text-sm text-primary-warm-white">
                {{ t(metric.labelKey) }}
              </td>
              <td
                v-for="plan in comfyApiPlanLimits"
                :key="plan.id"
                class="px-4 py-3.5 text-right font-mono text-sm text-primary-warm-white"
              >
                {{ plan[metric.key] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

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
