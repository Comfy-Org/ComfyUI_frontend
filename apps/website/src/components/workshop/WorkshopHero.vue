<script setup lang="ts">
import { useSlots } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import SplitReveal from './SplitReveal.vue'

const {
  eyebrowKey = 'workshop.hero.eyebrow',
  headingKey = 'workshop.hero.heading',
  subtitleKey,
  locale = 'en'
} = defineProps<{
  eyebrowKey?: TranslationKey
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
        'relative isolate -mx-6 -mt-8 overflow-hidden px-6 pt-8 max-sm:-mt-5 max-sm:pt-5 lg:-mx-8 lg:-mt-12 lg:px-8 lg:pt-12',
        slots.default
          ? 'mb-8 max-sm:mb-5'
          : 'mb-6 pb-2 max-sm:mb-4 max-sm:pb-0 sm:short:pb-0'
      )
    "
    data-testid="workshop-hero"
  >
    <p
      class="mb-5 text-sm font-medium tracking-widest text-primary-comfy-yellow uppercase max-sm:mb-2"
    >
      <SplitReveal :text="t(eyebrowKey, locale)" />
    </p>
    <h1 class="text-3xl font-light text-primary-comfy-canvas lg:text-5xl">
      <SplitReveal :text="t(headingKey, locale)" :delay="90" />
    </h1>
    <div
      class="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 sm:short:mt-3"
    >
      <p v-if="subtitleKey" class="text-lg text-primary-comfy-canvas/70">
        <SplitReveal
          :text="t(subtitleKey, locale)"
          :delay="260"
          :stagger="50"
        />
      </p>
      <slot name="aside" />
    </div>

    <slot />
  </header>
</template>
