<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { SelectScrollDownButtonProps } from 'reka-ui'
import { SelectScrollDownButton } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const { class: className, ...restProps } = defineProps<
  SelectScrollDownButtonProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <SelectScrollDownButton
    v-bind="restProps"
    :class="
      cn(
        'flex cursor-default items-center justify-center py-1 text-muted-foreground',
        className
      )
    "
  >
    <slot>
      <i class="icon-[lucide--chevron-down]" />
    </slot>
  </SelectScrollDownButton>
</template>
