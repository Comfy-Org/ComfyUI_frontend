<template>
  <a
    v-if="typeof to === 'string'"
    :href="to"
    target="_blank"
    :rel
    :class="inline && INLINE"
  >
    <slot />
  </a>
  <button
    v-else
    type="button"
    :class="
      inline &&
      cn(
        INLINE,
        'cursor-pointer appearance-none border-none bg-transparent p-0 font-[inherit]'
      )
    "
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsBillingLinkTarget } from './addCreditsPresentation'

const {
  to,
  rel = 'noopener',
  inline = false
} = defineProps<{
  to: AddCreditsBillingLinkTarget
  rel?: string
  inline?: boolean
}>()

const INLINE = 'text-inherit underline'
</script>
