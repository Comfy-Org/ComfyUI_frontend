<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const {
  eyebrow,
  eyebrowClass,
  title,
  subtitle,
  class: className
} = defineProps<{
  eyebrow?: string
  eyebrowClass?: HTMLAttributes['class']
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
      :class="
        cn(
          'text-primary-comfy-yellow text-sm font-extrabold tracking-wider uppercase',
          eyebrowClass
        )
      "
    >
      {{ eyebrow }}
    </p>

    <h1
      class="mt-4 text-4xl/snug font-light tracking-tight text-pretty text-primary-warm-white lg:text-6xl/snug"
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
