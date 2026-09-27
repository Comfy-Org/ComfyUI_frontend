<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

export interface FeatureCardLink {
  label: string
  href: string
  suffix?: string
}

const {
  title,
  description,
  link,
  class: className
} = defineProps<{
  title: string
  description: string
  link?: FeatureCardLink
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <article
    :class="
      cn(
        'bg-transparency-white-t4 rounded-3xl border border-white/10 p-5 lg:p-6',
        className
      )
    "
  >
    <slot name="visual" />
    <h3
      :class="
        cn(
          'text-base font-normal text-primary-warm-white',
          $slots.visual && 'mt-4'
        )
      "
    >
      {{ title }}
    </h3>
    <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
      {{ description
      }}<template v-if="link"
        ><a
          :href="link.href"
          class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 rounded-sm underline underline-offset-2 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
          >{{ link.label }}</a
        >{{ link.suffix }}</template
      >
    </p>
    <slot />
  </article>
</template>
