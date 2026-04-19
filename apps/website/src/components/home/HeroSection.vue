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

function drawFrame(
  canvas: HTMLCanvasElement,
  draw: CanvasRenderingContext2D,
  frame: number
) {
  const index = Math.round(frame)
  const img = images[index]
  if (!img) return
  canvas.width = img.width
  canvas.height = img.height
  draw.drawImage(img, 0, 0)
}

onMounted(() => {
  const canvas = canvasRef.value
  const draw = canvas?.getContext('2d')
  if (!canvas || !draw) return

  const render = (frame: number) => drawFrame(canvas, draw, frame)
  const reducedMotion = prefersReducedMotion()
  let settledCount = 0
  let hasSuccessfulFrame = false

  function onSettled(success: boolean) {
    if (success) hasSuccessfulFrame = true
    settledCount++
    if (settledCount === FRAME_COUNT && hasSuccessfulFrame) {
      render(0)
      if (reducedMotion) return
      const proxy = { frame: 0 }
      ctx = gsap.context(() => {
        gsap.to(proxy, {
          frame: FRAME_COUNT - 1,
          duration: 4,
          ease: 'none',
          repeat: -1,
          onUpdate() {
            render(proxy.frame)
          }
        })
      })
    }
  }

  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image()
    img.src = `https://media.comfy.org/website/homepage/hero-logo-seq/Logo${String(i).padStart(2, '0')}.webp`
    img.onload = () => onSettled(true)
    img.onerror = () => onSettled(false)
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
    class="relative flex min-h-auto flex-col lg:flex-row lg:items-center"
  >
    <div class="relative flex-1">
      <canvas ref="canvasRef" class="w-full" />
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
