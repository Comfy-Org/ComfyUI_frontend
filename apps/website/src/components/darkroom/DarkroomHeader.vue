<script setup lang="ts">
import AppsBackLink from '@/components/workshop/cinematic-studio/AppsBackLink.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <header class="mx-auto w-full max-w-10xl px-4 pt-8 sm:px-8 lg:px-14">
    <AppsBackLink :locale class="mb-5" />
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold text-primary-warm-white lg:text-3xl">
        {{ t('darkroom.title') }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ t('darkroom.beta') }}
      </span>
    </div>
    <p class="text-lg text-primary-warm-gray">{{ t('darkroom.lead') }}</p>
  </header>
</template>
