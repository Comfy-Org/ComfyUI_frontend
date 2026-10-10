<script setup lang="ts">
import type { AnchorHTMLAttributes, Component, HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { AdminButtonVariants } from './adminButton'
import { adminButtonVariants } from './adminButton'

const {
  variant,
  size,
  class: className,
  disabled = false,
  icon,
  href,
  type = 'button'
} = defineProps<{
  variant?: AdminButtonVariants['variant']
  size?: AdminButtonVariants['size']
  class?: HTMLAttributes['class']
  disabled?: boolean
  icon?: Component
  href?: AnchorHTMLAttributes['href']
  type?: 'button' | 'submit'
}>()
</script>

<template>
  <a
    v-if="href && !disabled"
    :href
    :class="cn(adminButtonVariants({ variant, size }), className)"
  >
    <component :is="icon" v-if="icon" aria-hidden="true" />
    <slot />
  </a>
  <button
    v-else
    :type
    :disabled
    :class="cn(adminButtonVariants({ variant, size }), className)"
  >
    <component :is="icon" v-if="icon" aria-hidden="true" />
    <slot />
  </button>
</template>
