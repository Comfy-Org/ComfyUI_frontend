<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { ref } from 'vue'

import { t } from '../../i18n/translations'

const {
  arcadeId,
  title,
  locale = 'en'
} = defineProps<{
  arcadeId: string
  title: string
  locale?: Locale
}>()

const loaded = ref(false)
</script>

<template>
  <section
    class="px-4 py-8 lg:px-20 lg:py-16"
    :aria-label="t('demos.embed.label', locale)"
  >
    <div
      class="relative mx-auto aspect-video max-w-6xl overflow-hidden rounded-4xl border border-white/10"
    >
      <div
        v-if="!loaded"
        aria-hidden="true"
        class="absolute inset-0 flex flex-col items-center justify-center bg-black/50"
      >
        <div
          class="border-primary-comfy-canvas/60 mb-4 size-10 animate-pulse rounded-full border-2"
        />
        <p class="text-primary-warm-gray text-sm">
          {{ t('demos.loading', locale) }}
        </p>
      </div>

      <iframe
        class="size-full"
        :src="`https://demo.arcade.software/${arcadeId}?embed&show_title=0`"
        :title="`${t('demos.embed.label', locale)}: ${title}`"
        loading="lazy"
        allow="clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin"
        @load="loaded = true"
      />
    </div>

    <noscript>
      <p class="text-primary-warm-gray mt-4 text-sm">
        {{ t('demos.noscript', locale) }}
        <a
          class="text-primary-comfy-yellow ml-2 underline"
          :href="`https://demo.arcade.software/${arcadeId}`"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ t('demos.noscript.link', locale) }}
        </a>
      </p>
    </noscript>
  </section>
</template>
