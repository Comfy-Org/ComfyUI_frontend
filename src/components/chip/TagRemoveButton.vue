<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

import { tagRemoveButtonVariants } from '@comfyorg/design-system/tag.variants'

const { tooltip, class: className } = defineProps<{
  tooltip?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <Button
    :tooltip
    type="button"
    variant="textonly"
    size="icon-sm"
    :class="cn(tagRemoveButtonVariants(), 'opacity-60', className)"
  >
    <slot>
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </slot>
  </Button>
</template>
