<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { minimaxH3Highlights } from '../../data/minimaxH3'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <h2
      class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
    >
      {{ t('minimaxH3.highlights.heading', locale) }}
    </h2>

    <dl class="mt-10 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="highlight in minimaxH3Highlights"
        :key="highlight.id"
        class="bg-transparency-white-t4 flex flex-col gap-3 p-6 lg:p-8"
      >
        <dt class="text-primary-comfy-yellow text-lg font-semibold">
          {{ highlight.label[locale] }}
        </dt>
        <dd class="text-sm/relaxed font-light text-primary-comfy-canvas/70">
          {{ highlight.detail[locale] }}
        </dd>
      </div>
    </dl>
  </section>
</template>
