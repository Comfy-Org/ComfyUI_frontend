<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { localizeHref } from '../../config/routes'
import { t } from '../../i18n/translations'

const {
  nextTitle,
  nextSlug,
  nextThumbnail,
  locale = 'en'
} = defineProps<{
  nextTitle: string
  nextSlug: string
  nextThumbnail: string
  locale?: Locale
}>()

const nextHref = localizeHref(`/demos/${nextSlug}`, locale)
</script>

<template>
  <section class="px-4 py-16 lg:px-20 lg:py-24">
    <h2 class="mb-10 text-2xl font-light text-primary-comfy-canvas lg:text-3xl">
      {{ t('demos.nav.nextDemo' as TranslationKey, locale) }}
    </h2>

    <div
      class="bg-transparency-white-t4 rounded-5xl mx-auto flex flex-col gap-8 p-2 lg:max-w-237.5 lg:flex-row lg:items-center"
    >
      <a :href="nextHref" class="shrink-0 lg:w-1/2">
        <img
          :src="nextThumbnail"
          :alt="nextTitle"
          loading="lazy"
          decoding="async"
          class="w-full rounded-4xl object-cover"
        />
      </a>

      <div class="flex flex-col gap-6">
        <h3 class="text-xl font-light text-primary-comfy-canvas lg:text-2xl">
          {{ nextTitle }}
        </h3>

        <a :href="nextHref" class="flex items-center gap-3">
          <span
            class="bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-full text-primary-comfy-ink"
          >
            <span class="text-lg font-bold">›</span>
          </span>
          <span
            class="ppformula-text-center text-sm font-semibold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('demos.nav.viewDemo' as TranslationKey, locale) }}
          </span>
        </a>
      </div>
    </div>
  </section>
</template>
