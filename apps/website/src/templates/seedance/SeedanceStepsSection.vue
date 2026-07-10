<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { seedanceSteps } from '../../data/seedance'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const stepNumber = (index: number) => String(index + 1).padStart(2, '0')
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-10 pb-24 lg:px-20">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t('seedance.steps.heading', locale) }}
      </h2>
      <p class="mt-5 text-base/relaxed font-light text-primary-comfy-canvas/80">
        {{ t('seedance.steps.leadIn', locale) }}
      </p>
    </div>

    <ol class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
      <li
        v-for="(step, index) in seedanceSteps"
        :key="step.id"
        class="rounded-4.5xl bg-transparency-white-t4 flex flex-col gap-8 p-2"
      >
        <div class="aspect-4/3 overflow-hidden rounded-4xl">
          <video
            v-if="step.imageSrc.endsWith('.webm')"
            :src="step.imageSrc"
            class="size-full object-cover"
            autoplay
            loop
            muted
            playsinline
          />
          <img
            v-else
            :src="step.imageSrc"
            alt=""
            class="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="flex flex-col gap-8 p-5">
          <p
            class="text-primary-comfy-yellow text-sm font-extrabold tracking-wider uppercase"
          >
            {{ t('seedance.steps.step', locale) }} {{ stepNumber(index) }}
          </p>
          <p class="text-3xl/snug font-medium text-primary-comfy-canvas">
            {{ step.title[locale] }}
          </p>
          <p class="text-base/relaxed font-light text-primary-comfy-canvas">
            {{ step.description[locale] }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
