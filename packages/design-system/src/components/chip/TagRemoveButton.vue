<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
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
      <i class="icon-[lucide--x]" aria-hidden="true" />
    </slot>
  </Button>
</template>
