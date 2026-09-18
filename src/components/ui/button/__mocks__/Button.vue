<script setup lang="ts">
import type { ButtonVariants } from '../button.variants'

const {
  variant,
  loading = false,
  disabled = false
} = defineProps<{
  variant?: ButtonVariants['variant']
  loading?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <button
    :data-variant="variant"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <slot />
  </button>
</template>
