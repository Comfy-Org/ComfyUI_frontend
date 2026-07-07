<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { Primitive } from 'reka-ui'

import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/cn'

const buttonVariants = cva(
  'rounded-agent focus-visible:ring-agent-accent inline-flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-agent-accent text-agent-accent-fg hover:bg-agent-accent/90',
        ghost:
          'text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg',
        outline:
          'border-agent-border text-agent-fg hover:bg-agent-surface-hover border bg-transparent',
        danger: 'bg-agent-danger text-agent-accent-fg hover:bg-agent-danger/90'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3',
        icon: 'size-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonVariants = VariantProps<typeof buttonVariants>

const {
  variant,
  size,
  as = 'button',
  asChild = false,
  class: cls
} = defineProps<{
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  as?: string
  asChild?: boolean
  class?: string
}>()
</script>

<template>
  <Primitive
    :as
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), cls)"
  >
    <slot />
  </Primitive>
</template>
