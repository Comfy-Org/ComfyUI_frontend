<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type {
  PlanFeatureGroup,
  PlanFeatureStatus
} from '../../data/pricingPlans'

import { BookOpen, Check, Clock, X } from '@lucide/vue'

import { t } from '../../i18n/translations'

export type { PlanFeatureGroup }

const statusIcon = {
  included: Check,
  excluded: X,
  coming: Clock
} as const

const statusIconClass: Record<PlanFeatureStatus, string> = {
  included: 'text-primary-comfy-yellow',
  excluded: 'text-primary-comfy-canvas/40',
  coming: 'text-primary-warm-gray'
}

const statusTextClass: Record<PlanFeatureStatus, string> = {
  included: 'text-primary-warm-white',
  excluded: 'text-primary-warm-gray',
  coming: 'text-primary-warm-gray'
}

const { locale = 'en' } = defineProps<{
  features: PlanFeatureGroup[]
  locale?: Locale
}>()
</script>

<template>
  <div class="flex flex-col gap-5">
    <div
      v-for="(group, groupIndex) in features"
      :key="group.titleKey ?? groupIndex"
      class="flex flex-col gap-2"
    >
      <p v-if="group.titleKey" class="text-sm text-primary-comfy-canvas">
        {{ t(group.titleKey, locale) }}
      </p>
      <ul class="space-y-2">
        <li
          v-for="feature in group.features"
          :key="feature.text"
          class="flex items-start gap-2"
        >
          <component
            :is="
              feature.highlight
                ? BookOpen
                : statusIcon[feature.status ?? 'included']
            "
            class="mt-0.5 size-4 shrink-0"
            :class="
              feature.highlight
                ? 'text-primary-comfy-yellow'
                : statusIconClass[feature.status ?? 'included']
            "
            aria-hidden="true"
          />
          <span class="sr-only">
            {{
              t(
                `pricing.plan.feature.status.${feature.status ?? 'included'}`,
                locale
              )
            }}:
          </span>
          <span
            class="ppformula-text-center text-sm"
            :class="
              feature.highlight
                ? 'text-primary-comfy-yellow'
                : statusTextClass[feature.status ?? 'included']
            "
          >
            {{ t(feature.text, locale) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
