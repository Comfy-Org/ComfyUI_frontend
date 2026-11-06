<template>
  <a
    v-if="href"
    :href
    target="_blank"
    rel="noopener"
    :class="cn(buttonVariants({ variant, size }), 'shrink-0 no-underline')"
    @click="emit('click')"
  >
    {{ label }}
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
  </CheckoutButton>
</template>

<script setup lang="ts">
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

const { href, label, variant, size, loading } = defineProps<{
  href: string | null
  label: string
  variant: 'inverted' | 'secondary'
  size: 'md' | 'lg'
  loading: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>
