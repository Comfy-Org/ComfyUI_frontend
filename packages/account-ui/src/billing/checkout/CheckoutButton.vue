<template>
  <button
    :type
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="cn(buttonVariants({ variant, size }), customClass)"
  >
    <i
      v-if="loading"
      class="icon-[lucide--loader-circle] animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
    <template v-if="loading">
      <span class="sr-only"><slot /></span>
    </template>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
/**
 * The cloud app's Button, as a native button: same variant classes, same
 * loading treatment (spinner with the label kept for screen readers).
 */
import type { HTMLAttributes } from 'vue'

import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

const {
  type = 'button',
  class: customClass = '',
  loading = false,
  disabled = false
} = defineProps<{
  type?: 'button' | 'submit'
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  loading?: boolean
  disabled?: boolean
}>()
</script>
