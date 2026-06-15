<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ArrowUpRight } from '@lucide/vue'
import { Primitive } from 'reka-ui';
import type { PrimitiveProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue'

import type { PillButtonVariants } from '.'
import { pillButtonBadgeVariants, pillButtonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: PillButtonVariants['variant']
  size?: PillButtonVariants['size']
  iconPosition?: PillButtonVariants['iconPosition']
  class?: HTMLAttributes['class']
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  hideLabel: false
})
</script>

<template>
  <Primitive
    data-slot="pill-button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :disabled="disabled"
    :class="
      cn(pillButtonVariants({ variant, size, iconPosition }), props.class)
    "
  >
    <span :class="cn('relative leading-none transition-all duration-500')">
      <slot />
    </span>
    <span
      :class="pillButtonBadgeVariants({ variant, size, iconPosition })"
      aria-hidden="true"
    >
      <span class="inline-flex transition-transform duration-500">
        <slot name="icon">
          <ArrowUpRight class="size-4" :stroke-width="2" />
        </slot>
      </span>
    </span>
  </Primitive>
</template>
