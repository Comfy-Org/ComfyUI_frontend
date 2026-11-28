<template>
  <a
    v-if="href"
    :href
    target="_blank"
    rel="noopener"
    :data-variant="variant"
    :class="cn(buttonVariants({ variant, size }), 'shrink-0 no-underline')"
    @click="emit('click')"
  >
    {{ label }}
    <slot />
  </a>
  <CheckoutButton
    v-else
    :variant
    :size
    :loading
    class="shrink-0"
    @click="emit('click')"
  >
    {{ label }}
    <slot />
  </CheckoutButton>
</template>

<script setup lang="ts">
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

const {
  href,
  label,
  variant,
  size,
  loading = false
} = defineProps<{
  href: string | null
  label: string
  variant: ButtonVariants['variant']
  size: 'md' | 'lg'
  loading?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>
