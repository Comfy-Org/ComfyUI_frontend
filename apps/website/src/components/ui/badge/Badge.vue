<script setup lang="ts">
import type { Component } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { BadgeVariants } from '.'
import { badgeVariants } from '.'

const {
  variant,
  size,
  class: className,
  prependIcon,
  appendIcon
} = defineProps<{
  variant?: BadgeVariants['variant']
  size?: BadgeVariants['size']
  class?: string
  prependIcon?: Component
  appendIcon?: Component
}>()
</script>

<template>
  <span
    data-slot="badge"
    :data-variant="variant"
    :data-size="size"
    :class="cn(badgeVariants({ size, variant }), className)"
  >
    <slot name="prepend">
      <component :is="prependIcon" v-if="prependIcon" />
    </slot>
    <span>
      <slot />
    </span>
    <slot name="append">
      <component :is="appendIcon" v-if="appendIcon" />
    </slot>
  </span>
</template>
