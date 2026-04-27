<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="relative flex min-h-auto flex-col lg:flex-row lg:items-center"
  >
    <div class="relative flex-1">
      <video
        src="https://media.comfy.org/website/homepage/hero-logo-seq.webm"
        autoplay
        loop
        muted
        playsinline
        class="w-full"
      />
    </div>

    <div class="flex-1 px-6 py-12 lg:px-16">
      <h1
        class="text-primary-comfy-canvas text-4xl font-light whitespace-pre-line lg:text-6xl"
      >
        {{ t('hero.title', locale) }}
      </h1>

      <p
        class="text-primary-comfy-canvas mt-8 max-w-lg text-sm/relaxed lg:text-base"
      >
        {{ t('hero.subtitle', locale) }}
      </p>
    </div>
  </section>
</template>
