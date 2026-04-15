<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="relative overflow-hidden px-4 py-24 lg:px-20 lg:py-32">
    <!-- Decorative images -->
    <!-- Top-left -->
    <div
      class="absolute top-0 -left-8 size-36 rounded-3xl bg-smoke-200 lg:left-[10%] lg:size-64"
      role="img"
      aria-hidden="true"
    />
    <!-- Top-right -->
    <div
      class="absolute top-0 -right-8 size-28 rounded-3xl bg-smoke-200 lg:top-4 lg:right-[2%] lg:size-40"
      role="img"
      aria-hidden="true"
    />
    <!-- Middle-left -->
    <div
      class="absolute top-1/3 -left-12 size-40 rounded-3xl bg-smoke-200 lg:top-[35%] lg:left-[2%] lg:h-56 lg:w-48"
      role="img"
      aria-hidden="true"
    />
    <!-- Middle-right -->
    <div
      class="absolute top-[45%] -right-4 hidden h-48 w-72 rounded-3xl bg-smoke-200 lg:block"
      role="img"
      aria-hidden="true"
    />
    <!-- Bottom-right -->
    <div
      class="absolute -right-4 bottom-8 hidden size-48 rounded-3xl bg-smoke-200 lg:block"
      role="img"
      aria-hidden="true"
    />

    <!-- Text content -->
    <div
      class="relative z-10 mx-auto flex max-w-3xl flex-col items-center py-16 text-center lg:py-24"
    >
      <h2 class="text-primary-comfy-canvas text-5xl font-light lg:text-8xl">
        {{ t('enterprise.ownership.line1', locale) }}
      </h2>
      <h2
        class="text-primary-comfy-canvas mt-6 text-5xl font-light lg:mt-10 lg:text-8xl"
      >
        {{ t('enterprise.ownership.line2', locale) }}
      </h2>
      <h2
        class="text-primary-comfy-canvas mt-6 text-5xl font-light lg:mt-10 lg:text-8xl"
      >
        {{ t('enterprise.ownership.line3', locale) }}
      </h2>
      <p
        class="text-primary-comfy-canvas mt-12 max-w-xl text-sm lg:mt-16 lg:text-base"
      >
        {{ t('enterprise.ownership.subtitle', locale) }}
      </p>
    </div>
  </section>
</template>
