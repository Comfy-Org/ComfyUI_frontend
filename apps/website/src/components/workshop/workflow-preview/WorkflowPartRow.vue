<script setup lang="ts">
import type { Component } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { icon, name, href, textClass } = defineProps<{
  icon: Component
  name: string
  href?: string
  textClass: string
}>()
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href
    class="group flex items-center gap-2.5 rounded-lg py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
  >
    <component
      :is="icon"
      class="size-4 shrink-0 text-primary-warm-gray"
      aria-hidden="true"
    />
    <span
      :class="
        cn(
          'min-w-0 flex-1 truncate text-primary-comfy-canvas',
          textClass,
          href && 'transition-colors group-hover:text-primary-comfy-yellow'
        )
      "
    >
      {{ name }}
    </span>
  </component>
</template>
