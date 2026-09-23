<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue'

import { resolveRel } from '../../utils/cta'
import type { BrandButtonVariants } from './brandButton.variants'
import { brandButtonVariants } from './brandButton.variants'

const props = defineProps<{
  href?: string
  target?: string
  rel?: string
  download?: AnchorHTMLAttributes['download']
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
    :download="props.download"
    :class="
      cn(
        brandButtonVariants({ variant: props.variant, size: props.size }),
        props.class ?? ''
      )
    "
  >
    <span class="ppformula-text-center inline-block">
      <slot />
    </span>
  </component>
</template>
