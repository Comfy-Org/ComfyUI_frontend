<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'
import { Primitive } from 'reka-ui'
import type { PrimitiveProps } from 'reka-ui'

import type { HTMLAttributes } from 'vue'

import type { ButtonMaskVariants } from '.'
import {
  BUTTON_MASK_LABEL_CLASS,
  buttonMaskBadgeVariants,
  buttonMaskVariants
} from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonMaskVariants['variant']
  size?: ButtonMaskVariants['size']
  iconPosition?: ButtonMaskVariants['iconPosition']
  hideLabel?: boolean
  class?: HTMLAttributes['class']
  disabled?: boolean
}

const {
  as = 'button',
  asChild,
  variant,
  size,
  iconPosition,
  hideLabel = true,
  class: className,
  disabled
} = defineProps<Props>()
</script>

<template>
  <Primitive
    data-slot="button-mask"
    :data-variant="variant"
    :data-size="size"
    :as
    :as-child
    :disabled
    :class="cn(buttonMaskVariants({ variant, size, iconPosition }), className)"
  >
    <span
      :data-icon-position="iconPosition ?? 'right'"
      :data-hidden="hideLabel ? 'true' : 'false'"
      :class="BUTTON_MASK_LABEL_CLASS"
    >
      <slot />
    </span>
    <span
      :class="buttonMaskBadgeVariants({ variant, size, iconPosition })"
      aria-hidden="true"
    >
      <span class="inline-flex transition-transform duration-500">
        <slot name="icon">
          <ChevronRight class="size-4" :stroke-width="2" />
        </slot>
      </span>
    </span>
  </Primitive>
</template>
