<script setup lang="ts">
import type { DropdownMenuLabelProps } from 'reka-ui'
import { DropdownMenuLabel, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <DropdownMenuLabel
    v-bind="forwarded"
    :class="
      cn('px-3 py-1.5 text-xs font-semibold text-muted-foreground', className)
    "
  >
    <slot />
  </DropdownMenuLabel>
</template>
