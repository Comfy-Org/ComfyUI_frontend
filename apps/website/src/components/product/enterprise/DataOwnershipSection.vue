<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../../i18n/translations'

import { useParallax } from '../../../composables/useParallax'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const sectionRef = ref<HTMLElement>()
const topLeftRef = ref<HTMLElement>()
const topRightRef = ref<HTMLElement>()
const midLeftRef = ref<HTMLElement>()
const midRightRef = ref<HTMLElement>()
const bottomLeftRef = ref<HTMLElement>()
const bottomRightRef = ref<HTMLElement>()

useParallax([topLeftRef, topRightRef], { trigger: sectionRef, y: 200 })
useParallax([midLeftRef, midRightRef], { trigger: sectionRef, y: 300 })
useParallax([bottomLeftRef, bottomRightRef], { trigger: sectionRef, y: 400 })
</script>

<template>
  <section
    ref="sectionRef"
    class="relative overflow-x-clip px-4 py-24 lg:px-20 lg:py-32"
  >
    <!-- Decorative media — left column -->
    <img
      ref="topLeftRef"
      src="https://media.comfy.org/website/gallery/gallery.webp"
      alt=""
      class="absolute top-4 -left-6 size-36 rounded-3xl object-cover lg:top-8 lg:left-[8%] lg:h-72 lg:w-64"
      aria-hidden="true"
    />
    <img
      ref="midLeftRef"
      src="https://media.comfy.org/website/enterprise/retro-sakura-window.webp"
      alt=""
      class="absolute top-[40%] -left-10 h-44 w-40 rounded-3xl object-cover lg:top-[38%] lg:-left-4 lg:h-56 lg:w-52"
      aria-hidden="true"
    />
    <video
      ref="bottomLeftRef"
      src="https://media.comfy.org/videos/compressed_256/flower.webm"
      autoplay
      loop
      muted
      playsinline
      class="absolute top-[58%] -left-12 size-36 rounded-3xl object-cover lg:top-[56%] lg:-left-6 lg:size-48"
      aria-hidden="true"
    />

    <!-- Decorative media — right column -->
    <video
      ref="topRightRef"
      src="https://media.comfy.org/videos/compressed_256/eye.webm"
      autoplay
      loop
      muted
      playsinline
      class="absolute top-0 -right-6 h-28 w-32 rounded-3xl object-cover lg:top-4 lg:-right-4 lg:h-32 lg:w-36"
      aria-hidden="true"
    />
    <video
      ref="midRightRef"
      src="https://media.comfy.org/videos/compressed_256/clouds.webm"
      autoplay
      loop
      muted
      playsinline
      class="absolute top-[42%] -right-4 hidden h-48 w-80 rounded-3xl object-cover lg:block"
      aria-hidden="true"
    />
    <img
      ref="bottomRightRef"
      src="https://media.comfy.org/website/enterprise/glitter-metallic-face.webp"
      alt=""
      class="absolute top-[62%] -right-4 hidden h-44 w-56 rounded-3xl object-cover lg:block"
      aria-hidden="true"
    />

    <!-- Text content -->
    <div
      class="relative z-10 mx-auto flex max-w-3xl flex-col items-center py-16 text-center lg:py-24"
    >
      <h2
        class="text-primary-comfy-canvas flex flex-col gap-6 text-5xl font-light lg:gap-10 lg:text-8xl"
      >
        <span>{{ t('enterprise.ownership.line1', locale) }}</span>
        <span>{{ t('enterprise.ownership.line2', locale) }}</span>
        <span>{{ t('enterprise.ownership.line3', locale) }}</span>
      </h2>
      <p
        class="text-primary-comfy-canvas mt-12 max-w-xl text-sm lg:mt-16 lg:text-base"
      >
        {{ t('enterprise.ownership.subtitle', locale) }}
      </p>
    </div>
  </section>
</template>
