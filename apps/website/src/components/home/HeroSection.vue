<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { gsap } from '../../scripts/gsapSetup'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const canvasRef = ref<HTMLCanvasElement>()

const FRAME_COUNT = 75
const images: HTMLImageElement[] = []
let ctx: gsap.Context | undefined

onMounted(() => {
  if (!canvasRef.value || prefersReducedMotion()) return
  const canvas = canvasRef.value
  const draw = canvas.getContext('2d')
  if (!draw) return

  let loadedCount = 0

  function drawFrame(frame: number) {
    const index = Math.round(frame)
    const img = images[index]
    if (!img || !draw) return
    canvas.width = img.width
    canvas.height = img.height
    draw.drawImage(img, 0, 0)
  }

  function onFrameReady() {
    loadedCount++
    if (loadedCount === FRAME_COUNT) {
      drawFrame(0)
      const proxy = { frame: 0 }
      ctx = gsap.context(() => {
        gsap.to(proxy, {
          frame: FRAME_COUNT - 1,
          duration: 4,
          ease: 'none',
          repeat: -1,
          onUpdate() {
            drawFrame(proxy.frame)
          }
        })
      })
    }
  }

  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image()
    img.src = `/videos/hero-logo-seq/Logo${String(i).padStart(2, '0')}.webp`
    img.onload = onFrameReady
    img.onerror = onFrameReady
    images.push(img)
  }
})

onUnmounted(() => {
  images.forEach((img) => {
    img.onload = null
    img.onerror = null
  })
  images.length = 0
  ctx?.revert()
})
</script>

<template>
  <section
    class="relative flex min-h-screen flex-col lg:flex-row lg:items-center"
  >
    <div class="relative w-full lg:w-3/5">
      <canvas ref="canvasRef" class="w-full" />
    </div>

    <div class="px-6 py-12 lg:w-2/5 lg:px-16">
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
