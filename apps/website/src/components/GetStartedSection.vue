<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps = computed(() => [
  {
    number: '1',
    title: t('getStarted.step1.title', locale),
    description: t('getStarted.step1.desc', locale)
  },
  {
    number: '2',
    title: t('getStarted.step2.title', locale),
    description: t('getStarted.step2.desc', locale)
  },
  {
    number: '3',
    title: t('getStarted.step3.title', locale),
    description: t('getStarted.step3.desc', locale)
  }
])
</script>

<template>
  <section class="border-t border-white/10 bg-black py-24">
    <div class="mx-auto max-w-7xl px-6 text-center">
      <h2 class="text-3xl font-bold text-white">
        {{ t('getStarted.heading', locale) }}
      </h2>
      <p class="mt-4 text-smoke-700">
        {{ t('getStarted.subheading', locale) }}
      </p>

      <!-- Steps -->
      <div class="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div v-for="(step, index) in steps" :key="step.number" class="relative">
          <!-- Connecting line between steps (desktop only) -->
          <div
            v-if="index < steps.length - 1"
            class="absolute right-0 top-8 hidden w-full translate-x-1/2 border-t border-brand-yellow/20 md:block"
          />

          <div class="relative">
            <span class="text-6xl font-bold text-brand-yellow/20">
              {{ step.number }}
            </span>
            <h3 class="mt-2 text-xl font-semibold text-white">
              {{ step.title }}
            </h3>
            <p class="mt-2 text-sm text-smoke-700">
              {{ step.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <a
        href="/download"
        class="mt-12 inline-block rounded-full bg-brand-yellow px-8 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        {{ t('getStarted.cta', locale) }}
      </a>
    </div>
  </section>
</template>
