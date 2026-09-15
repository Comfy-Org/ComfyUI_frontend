<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { SelectScrollUpButtonProps } from 'reka-ui'
import { SelectScrollUpButton } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const { class: className, ...restProps } = defineProps<
  SelectScrollUpButtonProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <SelectScrollUpButton
    v-bind="restProps"
    :class="
      cn(
        'flex cursor-default items-center justify-center py-1 text-muted-foreground',
        className
      )
    "
  >
    <slot>
      <i class="icon-[lucide--chevron-up]" />
    </slot>
  </SelectScrollUpButton>
</template>
