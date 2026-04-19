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
        class="text-primary-comfy-canvas mt-4 text-3xl/tight font-light lg:text-5xl/tight"
      >
        {{ title }}
      </h1>

      <p
        class="text-primary-warm-gray mt-6 max-w-xl text-sm/relaxed lg:text-base/relaxed"
      >
        {{ description }}
      </p>

      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <span
          class="bg-transparency-white-t4 text-primary-comfy-canvas rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
        >
          {{ t(difficultyKey, locale) }}
        </span>
        <span
          class="bg-transparency-white-t4 text-primary-comfy-canvas rounded-full px-3 py-1 text-xs font-semibold"
        >
          {{ estimatedTime }}
        </span>
      </div>
    </div>
  </section>
</template>
