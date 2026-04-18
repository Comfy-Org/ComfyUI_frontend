<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const {
  title,
  image,
  href,
  locale = 'en'
} = defineProps<{
  title: string
  image: string
  href: string
  locale?: Locale
}>()
</script>

<template>
  <section class="px-4 py-16 lg:px-20 lg:py-24">
    <h2 class="text-primary-comfy-canvas mb-10 text-2xl font-light lg:text-3xl">
      {{ t('customers.story.whatsNext' as TranslationKey, locale) }}
    </h2>

    <div
      class="bg-transparency-white-t4 rounded-5xl mx-auto flex flex-col gap-8 p-2 lg:max-w-237.5 lg:flex-row lg:items-center"
    >
      <a :href="href" class="shrink-0 lg:w-1/2">
        <img
          :src="image"
          :alt="title"
          class="w-full rounded-4xl object-cover"
        />
      </a>

      <div class="flex flex-col gap-6">
        <h3 class="text-primary-comfy-canvas text-xl font-light lg:text-2xl">
          {{ title }}
        </h3>

        <a :href="href" class="flex items-center gap-3">
          <span
            class="bg-primary-comfy-yellow text-primary-comfy-ink flex size-10 items-center justify-center rounded-full"
          >
            <span class="text-lg font-bold">›</span>
          </span>
          <span
            class="text-primary-comfy-canvas ppformula-text-center text-sm font-semibold tracking-wider uppercase"
          >
            {{ t('customers.story.viewArticle' as TranslationKey, locale) }}
          </span>
        </a>
      </div>
    </div>
  </section>
</template>
