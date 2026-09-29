<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import SectionHeader from '../common/SectionHeader.vue'
import { comfyApiPlanLimits } from '../../data/comfyApiPlanLimits'
import { t } from '../../i18n/translations'
import PricingPlanLabel from './PricingPlanLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface MetricRow {
  key: 'totalBuildsLimit' | 'totalDeploymentsLimit' | 'maxWorkerConcurrency'
  labelKey: TranslationKey
}

const metricRows: MetricRow[] = [
  { key: 'totalBuildsLimit', labelKey: 'pricing.comfyApi.metric.builds' },
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
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="subsection">
      {{ t('pricing.comfyApi.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('pricing.comfyApi.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 flex max-w-3xl flex-col gap-4 lg:hidden">
      <article
        v-for="plan in comfyApiPlanLimits"
        :key="plan.id"
        class="rounded-4xl bg-transparency-white-t4 px-5 py-6"
      >
        <PricingPlanLabel :label="t(plan.labelKey, locale)" />
        <ul class="mt-5 space-y-4">
          <li
            v-for="metric in metricRows"
            :key="metric.key"
            class="flex items-center justify-between gap-4"
          >
            <p class="text-sm text-primary-warm-gray">
              {{ t(metric.labelKey, locale) }}
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
                {{ t('pricing.comfyApi.metricColumn', locale) }}
              </th>
              <th
                v-for="plan in comfyApiPlanLimits"
                :key="plan.id"
                class="p-4 text-right"
                scope="col"
              >
                {{ t(plan.labelKey, locale) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in metricRows" :key="metric.key">
              <td class="max-w-72 px-2 py-3.5 text-sm text-primary-warm-white">
                {{ t(metric.labelKey, locale) }}
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
  </section>
</template>
