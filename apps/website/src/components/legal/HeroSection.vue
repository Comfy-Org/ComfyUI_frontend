<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const { title, class: className } = defineProps<{
  title: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    class="flex items-center justify-center px-6 pt-20 pb-16 lg:pt-32 lg:pb-24"
  >
    <h1
      :class="
        cn(
          'text-4xl font-light text-primary-comfy-canvas lg:text-6xl',
          className
        )
      "
    >
      {{ title }}
    </h1>
  </section>
</template>
