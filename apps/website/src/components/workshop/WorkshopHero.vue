<script setup lang="ts">
import { useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import SplitReveal from './SplitReveal.vue'

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
        'lg:short:-mt-10 lg:short:pt-10 relative isolate -mx-6 -mt-16 overflow-hidden px-6 pt-16 max-sm:-mt-10 max-sm:pt-10 lg:-mx-8 lg:-mt-24 lg:px-8 lg:pt-24',
        slots.default ? 'mb-8 max-sm:mb-5' : 'mb-6 pb-2 max-sm:mb-4 max-sm:pb-0'
      )
    "
    data-testid="workshop-hero"
  >
    <p
      class="text-primary-comfy-yellow mb-5 text-sm font-medium tracking-widest uppercase max-sm:mb-2"
    >
      <SplitReveal :text="t('workshop.hero.eyebrow', locale)" />
    </p>
    <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
      <SplitReveal :text="t(headingKey, locale)" :delay="90" />
    </h1>
    <p v-if="subtitleKey" class="mt-4 text-lg text-primary-comfy-canvas/70">
      <SplitReveal :text="t(subtitleKey, locale)" :delay="260" :stagger="50" />
    </p>

    <slot />
  </header>
</template>
