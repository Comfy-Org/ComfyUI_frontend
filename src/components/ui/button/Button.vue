<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { buttonVariants } from '@comfyorg/design-system/button.variants'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  icon?: string
  indicator?: boolean
  loading?: boolean
  disabled?: boolean
}

const {
  as = 'button',
  class: customClass = '',
  loading = false,
  disabled = false
} = defineProps<Props>()

/** Keep a loading button focusable without allowing a second activation. */
function preventDisabledClick(event: MouseEvent): void {
  if (!loading && !disabled) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <Primitive
    :as
    :as-child
    :disabled="disabled"
    :aria-disabled="disabled || loading || undefined"
    :aria-busy="loading || undefined"
    :data-variant="variant"
    :class="
      cn(
        buttonVariants({ variant, size }),
        'aria-disabled:opacity-50',
        customClass
      )
    "
    @click.capture="preventDisabledClick"
  >
    <i v-if="loading" class="pi pi-spin pi-spinner" aria-hidden="true" />
    <template v-if="loading">
      <span class="sr-only"><slot /></span>
    </template>
    <template v-else>
      <i v-if="icon" :class="cn(icon, 'size-4 shrink-0')" aria-hidden="true" />
      <slot />
    </template>
    <span
      v-if="indicator"
      aria-hidden="true"
      class="pointer-events-none absolute -top-1 -right-1 size-2 rounded-full bg-base-foreground"
    />
  </Primitive>
</template>
