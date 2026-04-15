<script setup lang="ts">
import { ref } from 'vue'

import { useFrameScrub } from '../../composables/useFrameScrub'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const canvasRef = ref<HTMLCanvasElement>()

useFrameScrub(canvasRef, {
  frameCount: 75,
  frameSrc: (i) =>
    `/videos/hero-logo-seq/Logo${String(i).padStart(2, '0')}.webp`,
  scrollTrigger: (canvas) => ({
    trigger: document.documentElement,
    start: 'top top',
    end: () => {
      const rect = canvas.getBoundingClientRect()
      return `+=${rect.bottom + window.scrollY}`
    },
    scrub: 0.3
  })
})
</script>

<template>
  <section
    class="flex flex-col items-center px-4 py-16 lg:px-20 lg:pt-18 lg:pb-8"
  >
    <h1
      class="text-primary-comfy-canvas text-center text-5xl font-light whitespace-pre-line lg:text-8xl"
    >
      {{ t('hero.title', locale) }}
    </h1>

    <div class="mt-12 w-full max-w-3xl overflow-hidden rounded-2xl">
      <canvas ref="canvasRef" class="w-full" />
    </div>

    <p
      class="text-primary-comfy-canvas mt-10 max-w-2xl text-center text-sm/relaxed lg:text-base"
    >
      {{ t('hero.subtitle', locale) }}
    </p>
  </section>
</template>
