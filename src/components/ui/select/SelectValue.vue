<script setup lang="ts">
import type { SelectValueProps } from 'reka-ui'
import { SelectValue, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className, ...restProps } = defineProps<
  SelectValueProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <SelectValue v-bind="forwarded" :class="cn(className)">
    <slot />
  </SelectValue>
</template>
