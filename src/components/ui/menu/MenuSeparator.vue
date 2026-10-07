<script setup lang="ts">
import type { DropdownMenuSeparatorProps } from 'reka-ui'
import { DropdownMenuSeparator, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  DropdownMenuSeparatorProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <DropdownMenuSeparator
    v-bind="forwarded"
    :class="cn('my-1 h-px bg-border-subtle', className)"
  />
</template>
