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
const bottomRightRef = ref<HTMLElement>()

useParallax([topLeftRef, topRightRef], { trigger: sectionRef, y: 200 })
useParallax([midLeftRef, midRightRef], { trigger: sectionRef, y: 300 })
useParallax([bottomRightRef], { trigger: sectionRef, y: 400 })
</script>

<template>
  <section
    ref="sectionRef"
    class="relative overflow-x-clip px-4 py-24 lg:px-20 lg:py-32"
  >
    <!-- Decorative images -->
    <div
      ref="topLeftRef"
      class="absolute top-0 -left-8 size-36 rounded-3xl bg-smoke-200 lg:left-[10%] lg:size-64"
      aria-hidden="true"
    />
    <div
      ref="topRightRef"
      class="absolute top-0 -right-8 size-28 rounded-3xl bg-smoke-200 lg:top-4 lg:right-[2%] lg:size-40"
      aria-hidden="true"
    />
    <div
      ref="midLeftRef"
      class="absolute top-1/3 -left-12 size-40 rounded-3xl bg-smoke-200 lg:top-[35%] lg:left-[2%] lg:h-56 lg:w-48"
      aria-hidden="true"
    />
    <div
      ref="midRightRef"
      class="absolute top-[45%] -right-4 hidden h-48 w-72 rounded-3xl bg-smoke-200 lg:block"
      aria-hidden="true"
    />
    <div
      ref="bottomRightRef"
      class="absolute -right-4 bottom-8 hidden size-48 rounded-3xl bg-smoke-200 lg:block"
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
