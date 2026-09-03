<script setup lang="ts">
import { useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  headingKey = 'workshop.hero.heading',
  subtitleKey,
  locale = 'en'
} = defineProps<{
  headingKey?: TranslationKey
  subtitleKey?: TranslationKey
  locale?: Locale
}>()

const slots = useSlots()
</script>

<template>
  <header
    :class="
      cn(
        'relative isolate -mx-6 -mt-16 overflow-hidden px-6 pt-16 lg:-mx-8 lg:-mt-24 lg:px-8 lg:pt-24',
        slots.default ? 'mb-2' : 'mb-10 pb-8'
      )
    "
    data-testid="workshop-hero"
  >
    <p
      class="text-primary-comfy-yellow mb-5 text-sm font-medium tracking-widest uppercase"
    >
      {{ t('workshop.hero.eyebrow', locale) }}
    </p>
    <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
      {{ t(headingKey, locale) }}
    </h1>
    <p v-if="subtitleKey" class="mt-4 text-lg text-primary-comfy-canvas/70">
      {{ t(subtitleKey, locale) }}
    </p>

    <slot />
  </header>
</template>
