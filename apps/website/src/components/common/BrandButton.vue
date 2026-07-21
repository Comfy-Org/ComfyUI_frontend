<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { BrandButtonVariants } from './brandButton.variants'
import { brandButtonVariants } from './brandButton.variants'
import { resolveRel } from '../../utils/cta'

const props = defineProps<{
  href?: string
  target?: string
  rel?: string
  variant?: BrandButtonVariants['variant']
  size?: BrandButtonVariants['size']
  class?: HTMLAttributes['class']
}>()

const resolvedRel = computed(() =>
  resolveRel({ rel: props.rel, target: props.target })
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
    <slot />
  </component>
</template>
