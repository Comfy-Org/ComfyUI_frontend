<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

const {
  title,
  imageSrc,
  imageAlt = '',
  reverse = false,
  class: className
} = defineProps<{
  title: string
  imageSrc: string
  imageAlt?: string
  reverse?: boolean
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <div
      class="flex flex-col gap-2 p-2 lg:items-stretch"
      :class="reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'"
    >
      <div class="flex flex-col justify-start p-6 lg:flex-1 lg:p-10">
        <h2
          class="text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl"
        >
          {{ title }}
        </h2>
        <slot />
      </div>

      <div class="relative aspect-video w-full lg:flex-1">
        <img
          :src="imageSrc"
          :alt="imageAlt"
          loading="lazy"
          decoding="async"
          class="absolute inset-0 size-full rounded-4xl object-cover"
        />
      </div>
    </div>
  </section>
</template>
