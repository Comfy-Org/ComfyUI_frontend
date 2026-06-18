<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { BrandButtonVariants } from './brandButton.variants'
import { brandButtonVariants } from './brandButton.variants'

const props = defineProps<{
  href?: string
  target?: string
  rel?: string
  variant?: BrandButtonVariants['variant']
  size?: BrandButtonVariants['size']
  class?: HTMLAttributes['class']
}>()

const resolvedRel = computed(
  () =>
    props.rel ?? (props.target === '_blank' ? 'noopener noreferrer' : undefined)
)
</script>

<template>
  <component
    :is="props.href ? 'a' : 'button'"
    :href="props.href"
    :target="props.target"
    :rel="resolvedRel"
    :class="
      cn(
        brandButtonVariants({ variant: props.variant, size: props.size }),
        props.class ?? ''
      )
    "
  >
    <span class="ppformula-text-center">
      <slot />
    </span>
  </component>
</template>
