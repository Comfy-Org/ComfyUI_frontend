<script setup lang="ts">
import type { PrimitiveProps, TooltipContentProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import type { FunctionalComponent, HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { buttonVariants } from '@comfyorg/design-system/button.variants'

import ButtonTooltip from './ButtonTooltip.vue'

defineOptions({ inheritAttrs: false })

interface Props extends PrimitiveProps {
  class?: HTMLAttributes['class']
  disabled?: boolean
  icon?: string
  indicator?: boolean
  loading?: boolean
  size?: ButtonVariants['size']
  tooltip?: string
  tooltipSide?: TooltipContentProps['side']
  variant?: ButtonVariants['variant']
}

const {
  as = 'button',
  class: customClass = '',
  loading = false,
  disabled = false
} = defineProps<Props>()

const WithoutTooltip: FunctionalComponent = (_, { slots }) =>
  slots.default?.()[0]
</script>

<template>
  <component
    :is="tooltip ? ButtonTooltip : WithoutTooltip"
    :text="tooltip"
    :side="tooltipSide"
  >
    <Primitive
      :as
      :as-child
      :disabled="disabled || loading"
      :aria-busy="loading || undefined"
      :class="cn(buttonVariants({ variant, size }), customClass)"
      v-bind="$attrs"
    >
      <i
        v-if="loading"
        class="icon-[lucide--loader-circle] size-4 shrink-0 animate-spin"
        aria-hidden="true"
      />
      <template v-if="loading">
        <span class="sr-only"><slot /></span>
      </template>
      <template v-else>
        <i
          v-if="icon"
          :class="cn(icon, 'size-4 shrink-0')"
          aria-hidden="true"
        />
        <slot />
      </template>
      <span
        v-if="indicator"
        aria-hidden="true"
        class="pointer-events-none absolute -top-1 -right-1 size-2 rounded-full bg-base-foreground"
      />
    </Primitive>
  </component>
</template>
