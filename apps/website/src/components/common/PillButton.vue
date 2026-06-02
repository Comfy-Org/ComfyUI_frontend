<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import type { PillButtonVariants } from './pillButton.variants'
import {
  pillButtonBadgeVariants,
  pillButtonVariants
} from './pillButton.variants'

const {
  href,
  target,
  rel,
  type = 'button',
  disabled,
  ariaLabel,
  variant,
  size,
  iconPosition,
  hideLabel = false,
  class: customClass = ''
} = defineProps<{
  href?: string
  target?: string
  rel?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  ariaLabel?: string
  variant?: PillButtonVariants['variant']
  size?: PillButtonVariants['size']
  iconPosition?: PillButtonVariants['iconPosition']
  hideLabel?: boolean
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href || undefined"
    :target="href ? target : undefined"
    :rel="href ? rel : undefined"
    :type="!href ? type : undefined"
    :disabled="!href ? disabled : undefined"
    :aria-label="ariaLabel"
    :class="
      cn(pillButtonVariants({ variant, size, iconPosition }), customClass)
    "
  >
    <span
      :class="
        cn(
          'relative leading-none transition-all duration-500',
          hideLabel && 'opacity-0 group-hover:opacity-100'
        )
      "
    >
      <slot />
    </span>
    <span
      :class="pillButtonBadgeVariants({ variant, size, iconPosition })"
      aria-hidden="true"
    >
      <span class="inline-flex transition-transform duration-500">
        <slot name="icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </slot>
      </span>
    </span>
  </component>
</template>
