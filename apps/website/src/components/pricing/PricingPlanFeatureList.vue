<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { Check, Clock, X } from '@lucide/vue'

import { t } from '../../i18n/translations'

type PlanFeatureType = 'checked' | 'coming'

interface PlanFeature {
  text: TranslationKey
  type?: PlanFeatureType
  included?: boolean
}

export interface PlanFeatureGroup {
  titleKey?: TranslationKey
  features: PlanFeature[]
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
          <Clock
            v-if="feature.type === 'coming'"
            class="text-primary-warm-gray mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <Check
            v-else-if="feature.included !== false"
            class="text-primary-comfy-yellow mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <X
            v-else
            class="mt-0.5 size-4 shrink-0 text-primary-comfy-canvas/40"
            aria-hidden="true"
          />
          <span class="sr-only">
            {{
              feature.type === 'coming'
                ? t('pricing.plan.feature.status.coming', locale)
                : feature.included === false
                  ? t('pricing.plan.feature.status.notIncluded', locale)
                  : t('pricing.plan.feature.status.included', locale)
            }}:
          </span>
          <span
            class="ppformula-text-center text-sm"
            :class="
              feature.type === 'coming' || feature.included === false
                ? 'text-primary-warm-gray'
                : 'text-primary-warm-white'
            "
          >
            {{ t(feature.text, locale) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
