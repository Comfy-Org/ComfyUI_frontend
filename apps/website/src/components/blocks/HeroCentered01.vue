<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const {
  eyebrow,
  title,
  subtitle,
  class: className
} = defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="
      cn(
        'mx-auto flex max-w-4xl flex-col items-center px-6 text-center',
        className
      )
    "
  >
    <p
      v-if="eyebrow"
      class="text-primary-comfy-yellow text-sm font-extrabold tracking-wider uppercase"
    >
      {{ eyebrow }}
    </p>

    <h1
      class="text-primary-warm-white mt-4 text-4xl/snug font-light tracking-tight text-pretty lg:text-6xl/snug"
    >
      {{ title }}
    </h1>

    <p
      v-if="subtitle"
      class="mt-6 text-base font-light text-primary-comfy-canvas lg:text-lg"
    >
      {{ subtitle }}
    </p>

    <slot />
  </section>
</template>
