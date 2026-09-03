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
    class="relative isolate mb-10 overflow-hidden rounded-4xl px-8 py-10 lg:px-12 lg:py-12"
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
      class="from-page via-page/70 to-page/40 absolute inset-0 -z-10 bg-gradient-to-r"
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
  </header>
</template>
