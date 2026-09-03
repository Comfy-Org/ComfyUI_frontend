<script setup lang="ts">
import { computed } from 'vue'

import { workshopModels } from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import StaticFrame from './StaticFrame.vue'

const {
  headingKey = 'workshop.hero.heading',
  subtitleKey,
  locale = 'en'
} = defineProps<{
  headingKey?: TranslationKey
  subtitleKey?: TranslationKey
  locale?: Locale
}>()

// The catalogue is the decoration: a few of its own outputs, blurred past
// recognition, so the header carries the colour of what the page is for.
const backdrop = computed(() =>
  workshopModels
    .filter((model) => model.thumbnailUrl)
    .slice(0, 3)
    .map((model) => ({ slug: model.slug, url: model.thumbnailUrl as string }))
)
</script>

<template>
  <header
    class="relative isolate -mx-6 -mt-16 mb-10 overflow-hidden px-6 pt-16 pb-8 lg:-mx-8 lg:-mt-24 lg:px-8 lg:pt-24"
    data-testid="workshop-hero"
  >
    <div class="absolute inset-0 -z-10 flex" aria-hidden="true">
      <StaticFrame
        v-for="frame in backdrop"
        :key="frame.slug"
        :src="frame.url"
        class="size-full flex-1 scale-125 object-cover opacity-40 blur-3xl"
      />
    </div>
    <div
      class="from-page/95 via-page/75 to-page/95 absolute inset-0 -z-10 bg-gradient-to-b"
      aria-hidden="true"
    />

    <p
      class="text-primary-comfy-yellow mb-5 text-sm font-medium tracking-widest uppercase"
    >
      {{ t('workshop.hero.eyebrow', locale) }}
    </p>
    <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
      {{ t(headingKey, locale) }}
    </h1>
    <p
      v-if="subtitleKey"
      class="mt-4 max-w-2xl text-lg text-primary-comfy-canvas/70"
    >
      {{ t(subtitleKey, locale) }}
    </p>

    <slot />
  </header>
</template>
