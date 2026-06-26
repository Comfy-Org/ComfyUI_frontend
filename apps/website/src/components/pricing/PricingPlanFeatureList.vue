<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

import { t } from '../../i18n/translations'

interface PlanFeature {
  text: TranslationKey
}

const {
  features,
  featureIntroKey,
  nextUpKey,
  andMoreKey,
  nextUpClass = 'text-primary-comfy-canvas/80 mt-4 text-sm',
  andMoreClass = 'text-primary-comfy-canvas mt-4 text-sm',
  listGap = 'space-y-2',
  introMargin = 'mb-3',
  locale = 'en'
} = defineProps<{
  features: PlanFeature[]
  featureIntroKey?: TranslationKey
  nextUpKey?: TranslationKey
  andMoreKey?: TranslationKey
  nextUpClass?: string
  andMoreClass?: string
  listGap?: string
  introMargin?: string
  locale?: Locale
}>()
</script>

<template>
  <p
    v-if="featureIntroKey"
    :class="cn('text-primary-comfy-canvas text-sm font-semibold', introMargin)"
  >
    {{ t(featureIntroKey, locale) }}
  </p>
  <ul :class="listGap">
    <li
      v-for="feature in features"
      :key="feature.text"
      class="flex items-start gap-2"
    >
      <span class="text-primary-comfy-yellow mt-0.5 text-sm">✓</span>
      <span class="text-primary-comfy-canvas text-sm">
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
