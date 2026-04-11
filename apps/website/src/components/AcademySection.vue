<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const features = computed(() => [
  { icon: '📚', label: t('academy.tutorials', locale) },
  { icon: '🎥', label: t('academy.videos', locale) },
  { icon: '🛠️', label: t('academy.projects', locale) }
])
</script>

<template>
  <section class="bg-charcoal-800 py-24">
    <div class="mx-auto max-w-3xl px-6 text-center">
      <!-- Badge -->
      <span
        class="inline-block rounded-full bg-brand-yellow/10 px-4 py-1.5 text-xs tracking-widest text-brand-yellow uppercase"
      >
        {{ t('academy.badge', locale) }}
      </span>

      <h2 class="mt-6 text-3xl font-bold text-white">
        {{ t('academy.heading', locale) }}
      </h2>

      <p class="mt-4 text-smoke-700">
        {{ t('academy.body', locale) }}
      </p>

      <!-- Feature bullets -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-8">
        <div
          v-for="feature in features"
          :key="feature.label"
          class="flex items-center gap-2 text-sm text-white"
        >
          <span aria-hidden="true">{{ feature.icon }}</span>
          <span>{{ feature.label }}</span>
        </div>
      </div>

      <!-- CTA -->
      <a
        href="/academy"
        class="mt-8 inline-block rounded-full bg-brand-yellow px-8 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        {{ t('academy.cta', locale) }}
      </a>
    </div>
  </section>
</template>
