<script setup lang="ts">
import type { ComfyAgentPlanLimits } from '@/data/comfyAgentPlanLimits'
import type { Locale } from '@/i18n/translations'
import type { PlanLimitMetric } from './PlanLimitsTable.vue'

import SectionHeader from '@/components/common/SectionHeader.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'
import { getRoutes } from '@/config/routes'
import { comfyAgentPlanLimits } from '@/data/comfyAgentPlanLimits'
import { translationsFor } from '@/i18n/translations'
import PlanLimitsTable from './PlanLimitsTable.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const limits = ['availability', 'credits', 'runs', 'queue', 'model'] as const

const metrics: PlanLimitMetric<ComfyAgentPlanLimits>[] = [
  {
    labelKey: 'pricing.agent.metric.tasksPerMember',
    format: (plan) => plan.concurrentTasksPerMember
  },
  {
    labelKey: 'pricing.agent.metric.requestsPerWorkspace',
    format: (plan) => plan.concurrentRequestsPerWorkspace
  }
]
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="subsection">
      {{ t('pricing.agent.heading') }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('pricing.agent.subtitle') }}
        </p>
        <p class="mt-4 text-sm">
          <a
            :href="getRoutes(locale).agent"
            class="rounded-sm text-primary-comfy-canvas underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          >
            {{ t('pricing.agent.learnMore') }}
          </a>
        </p>
      </template>
    </SectionHeader>

    <PlanLimitsTable :plans="comfyAgentPlanLimits" :metrics :locale />

    <p class="mt-4 px-2 text-center text-xs text-primary-warm-gray">
      {{ t('pricing.agent.enterpriseNote') }}
      <a
        :href="getRoutes(locale).contact"
        class="rounded-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      >
        {{ t('pricing.enterprise.cta') }}
      </a>
    </p>

    <ul
      class="mx-auto mt-8 grid max-w-6xl gap-2 rounded-4xl bg-transparency-white-t4 p-2 sm:grid-cols-2 lg:grid-cols-3"
    >
      <li
        v-for="limit in limits"
        :key="limit"
        class="rounded-3xl bg-primary-comfy-ink p-6"
      >
        <div class="flex items-start gap-3">
          <CheckIcon class="mt-0.5 size-4 shrink-0 text-primary-comfy-yellow" />
          <p class="text-sm font-medium text-primary-comfy-canvas">
            {{ t(`pricing.agent.limit.${limit}.title`) }}
          </p>
        </div>
        <p class="mt-3 text-sm/relaxed text-primary-comfy-canvas/55">
          {{ t(`pricing.agent.limit.${limit}.description`) }}
        </p>
      </li>
    </ul>
  </section>
</template>
