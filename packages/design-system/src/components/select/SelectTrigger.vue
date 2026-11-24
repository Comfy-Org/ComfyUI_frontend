<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui'
import { SelectIcon, SelectTrigger } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { selectControlVariants } from './selectControl.variants'

const {
  class: className,
  size = 'lg',
  invalid = false,
  ...restProps
} = defineProps<
  SelectTriggerProps & {
    class?: HTMLAttributes['class']
    /** Trigger size: 'lg' (40px) or 'md' (32px) */
    size?: 'lg' | 'md'
    /** Show invalid (destructive) border */
    invalid?: boolean
  }
>()
</script>

<template>
  <SelectTrigger
    v-bind="restProps"
    :aria-invalid="invalid || undefined"
    :class="cn(selectControlVariants({ size, invalid }), className)"
  >
    <slot />
    <SelectIcon as-child>
      <i class="icon-[lucide--chevron-down] text-muted-foreground" />
    </SelectIcon>
  </SelectTrigger>
</template>
