<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <header class="mb-12" data-testid="workshop-hero">
    <p
      class="text-primary-comfy-yellow mb-5 text-sm font-medium tracking-widest uppercase"
    >
      {{ t('workshop.hero.eyebrow', locale) }}
    </p>
    <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
      {{ t('workshop.hero.heading', locale) }}
    </h1>
    <p class="mt-4 max-w-2xl text-lg text-primary-comfy-canvas/70">
      {{ t('workshop.hero.subtitle', locale) }}
    </p>
  </header>
</template>
