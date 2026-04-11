<script setup lang="ts">
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="bg-black py-24">
    <div class="mx-auto max-w-4xl px-6 text-center">
      <!-- Decorative quote mark -->
      <span class="text-6xl text-brand-yellow opacity-30" aria-hidden="true">
        &laquo;
      </span>

      <h2 class="text-4xl font-bold text-white md:text-5xl">
        {{ t('manifesto.heading', locale) }}
      </h2>

      <p class="mx-auto mt-6 max-w-2xl text-lg/relaxed text-smoke-700">
        {{ t('manifesto.body', locale) }}
      </p>

      <!-- Separator line -->
      <div
        class="mx-auto mt-8 h-0.5 w-24 bg-brand-yellow opacity-30"
        aria-hidden="true"
      />
    </div>
  </section>
</template>
