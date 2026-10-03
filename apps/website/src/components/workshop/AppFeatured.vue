<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { ac } from '../../lib/workshop/catalogue-apps'

const { app, locale = 'en' } = defineProps<{
  app: CatalogueApp
  locale?: Locale
}>()
</script>

<template>
  <a
    :href="app.href"
    class="group grid overflow-hidden rounded-3xl bg-hub-surface outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 md:grid-cols-2"
    data-testid="app-featured"
  >
    <div class="aspect-video overflow-hidden md:aspect-auto">
      <img
        v-if="app.image"
        :src="app.image"
        alt=""
        data-testid="app-featured-image"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        decoding="async"
      />
    </div>
    <div class="flex flex-col justify-center gap-3 p-6 lg:p-10">
      <p class="text-sm font-medium text-primary-comfy-yellow">
        {{ ac('featured', locale) }}
      </p>
      <h2 class="text-2xl font-medium text-primary-warm-white lg:text-3xl">
        {{ app.name }}
      </h2>
      <p class="text-content-secondary">{{ app.task }}</p>
      <span
        class="mt-3 inline-flex h-11 w-fit items-center rounded-2xl bg-primary-comfy-yellow px-6 text-sm font-bold text-primary-comfy-ink"
      >
        {{ ac('tryFree', locale) }}
      </span>
    </div>
  </a>
</template>
