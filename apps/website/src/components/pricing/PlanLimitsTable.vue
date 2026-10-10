<script
  setup
  lang="ts"
  generic="Plan extends { id: string; labelKey: TranslationKey }"
>
import type { Locale, TranslationKey } from '@/i18n/translations'

import { translationsFor } from '@/i18n/translations'
import PricingPlanLabel from './PricingPlanLabel.vue'

export interface PlanLimitMetric<P> {
  labelKey: TranslationKey
  format: (plan: P) => string | number
}

const { locale = 'en' } = defineProps<{
  plans: readonly Plan[]
  metrics: readonly PlanLimitMetric<Plan>[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div>
    <div class="mx-auto mt-8 flex max-w-3xl flex-col gap-4 lg:hidden">
      <article
        v-for="plan in plans"
        :key="plan.id"
        class="rounded-4xl bg-transparency-white-t4 px-5 py-6"
      >
        <PricingPlanLabel :label="t(plan.labelKey)" />
        <ul class="mt-5 space-y-4">
          <li
            v-for="metric in metrics"
            :key="metric.labelKey"
            class="flex items-center justify-between gap-4"
          >
            <p class="text-sm text-primary-warm-gray">
              {{ t(metric.labelKey) }}
            </p>
            <p class="font-mono text-sm text-primary-warm-white">
              {{ metric.format(plan) }}
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
                {{ t('pricing.planLimits.metricColumn') }}
              </th>
              <th
                v-for="plan in plans"
                :key="plan.id"
                class="p-4 text-right"
                scope="col"
              >
                {{ t(plan.labelKey) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in metrics" :key="metric.labelKey">
              <th
                scope="row"
                class="max-w-72 px-2 py-3.5 text-left text-sm font-normal text-primary-warm-white"
              >
                {{ t(metric.labelKey) }}
              </th>
              <td
                v-for="plan in plans"
                :key="plan.id"
                class="px-4 py-3.5 text-right font-mono text-sm text-primary-warm-white"
              >
                {{ metric.format(plan) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
