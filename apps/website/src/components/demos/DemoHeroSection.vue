<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const {
  label,
  title,
  description,
  difficulty,
  estimatedTime,
  locale = 'en'
} = defineProps<{
  label: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  locale?: Locale
}>()

const difficultyKey = `demos.difficulty.${difficulty}` as TranslationKey
</script>

<template>
  <section class="pt-16 lg:px-20 lg:pt-40 lg:pb-8">
    <div class="mx-auto flex max-w-4xl flex-col items-center text-center">
      <span
        class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
      >
        {{ label }}
      </span>

      <h1
        class="mt-4 text-3xl/tight font-light text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ title }}
      </h1>

      <p
        class="mt-6 max-w-xl text-sm/relaxed text-primary-warm-gray lg:text-base/relaxed"
      >
        {{ description }}
      </p>

      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <span
          class="bg-transparency-white-t4 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-primary-comfy-canvas uppercase"
        >
          {{ t(difficultyKey, locale) }}
        </span>
        <span
          class="bg-transparency-white-t4 rounded-full px-3 py-1 text-xs font-semibold text-primary-comfy-canvas"
        >
          {{ t(estimatedTime as TranslationKey, locale) }}
        </span>
      </div>
    </div>
  </section>
</template>
