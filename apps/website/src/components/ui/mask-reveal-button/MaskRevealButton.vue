<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ArrowUpRight } from '@lucide/vue'
import { Primitive } from 'reka-ui';
import type { PrimitiveProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue'

import type { MaskRevealButtonVariants } from '.'
import {
  MASK_REVEAL_LABEL_CLASS,
  maskRevealButtonBadgeVariants,
  maskRevealButtonVariants
} from '.'

interface Props extends PrimitiveProps {
  variant?: MaskRevealButtonVariants['variant']
  size?: MaskRevealButtonVariants['size']
  iconPosition?: MaskRevealButtonVariants['iconPosition']
  hideLabel?: boolean
  class?: HTMLAttributes['class']
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  hideLabel: true
})
</script>

<template>
  <Primitive
    data-slot="mask-reveal-button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :disabled="disabled"
    :class="
      cn(maskRevealButtonVariants({ variant, size, iconPosition }), props.class)
    "
  >
    <span
      :data-icon-position="iconPosition ?? 'right'"
      :data-hidden="hideLabel ? 'true' : 'false'"
      :class="MASK_REVEAL_LABEL_CLASS"
    >
      <slot />
    </span>
    <span
      :class="maskRevealButtonBadgeVariants({ variant, size, iconPosition })"
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
