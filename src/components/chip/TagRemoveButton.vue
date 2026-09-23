<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import { tagRemoveButtonVariants } from './tag.variants'

const {
  label,
  tooltip,
  class: className
} = defineProps<{
  label: string
  tooltip?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <Button
    v-tooltip.top="tooltip ? buildTooltipConfig(tooltip) : undefined"
    type="button"
    variant="textonly"
    size="icon-sm"
    :aria-label="label"
    :class="cn(tagRemoveButtonVariants(), 'opacity-60', className)"
  >
    <slot>
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </slot>
  </Button>
</template>
