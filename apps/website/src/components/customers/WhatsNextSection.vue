<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import GlassCard from '../common/GlassCard.vue'

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
    <h2 class="mb-10 text-2xl font-light text-primary-comfy-canvas lg:text-3xl">
      {{ t('customers.story.whatsNext' as TranslationKey, locale) }}
    </h2>

    <GlassCard
      class="mx-auto flex flex-col gap-8 lg:max-w-237.5 lg:flex-row lg:items-center"
    >
      <a :href="href" class="shrink-0 lg:w-1/2">
        <img
          :src="image"
          :alt="title"
          loading="lazy"
          decoding="async"
          class="w-full rounded-4xl object-cover"
        />
      </a>

      <div class="flex flex-col gap-6">
        <h3 class="text-xl font-light text-primary-comfy-canvas lg:text-2xl">
          {{ title }}
        </h3>

        <a :href="href" class="flex items-center gap-3">
          <span
            class="bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-full text-primary-comfy-ink"
          >
            <span class="text-lg font-bold">›</span>
          </span>
          <span
            class="ppformula-text-center text-sm font-semibold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('customers.story.viewArticle' as TranslationKey, locale) }}
          </span>
        </a>
      </div>
    </GlassCard>
  </section>
</template>
