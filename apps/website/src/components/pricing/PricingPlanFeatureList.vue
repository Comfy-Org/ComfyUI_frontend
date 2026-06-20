<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { Check, X } from '@lucide/vue'

import { t } from '../../i18n/translations'

interface PlanFeature {
  text: TranslationKey
  included?: boolean
}

const {
  features,
  nextUpKey,
  andMoreKey,
  nextUpClass = 'text-primary-comfy-canvas/80 mt-4 text-sm',
  andMoreClass = 'text-primary-comfy-canvas mt-4 text-sm',
  listGap = 'space-y-2',
  locale = 'en'
} = defineProps<{
  features: PlanFeature[]
  nextUpKey?: TranslationKey
  andMoreKey?: TranslationKey
  nextUpClass?: string
  andMoreClass?: string
  listGap?: string
  locale?: Locale
}>()
</script>

<template>
  <ul :class="listGap">
    <li
      v-for="feature in features"
      :key="feature.text"
      class="flex items-start gap-2"
    >
      <Check
        v-if="feature.included !== false"
        class="text-primary-comfy-yellow mt-0.5 size-4 shrink-0"
      />
      <X v-else class="mt-0.5 size-4 shrink-0 text-primary-comfy-canvas/40" />
      <span
        class="text-sm"
        :class="
          feature.included === false
            ? 'text-primary-comfy-canvas/40'
            : 'text-primary-comfy-canvas'
        "
      >
        {{ t(feature.text, locale) }}
      </span>
    </li>
  </ul>
  <p v-if="nextUpKey" :class="nextUpClass">
    {{ t(nextUpKey, locale) }}
  </p>
  <p v-if="andMoreKey" :class="andMoreClass">
    {{ t(andMoreKey, locale) }}
  </p>
</template>
