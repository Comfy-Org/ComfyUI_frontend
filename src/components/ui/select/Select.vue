<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from 'reka-ui'
import { SelectRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className, ...restProps } = defineProps<
  SelectRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<SelectRootEmits>()

const forwarded = useForwardPropsEmits(restProps, emits)
</script>

<template>
  <SelectRoot v-bind="forwarded" :class="cn(className)">
    <slot />
  </SelectRoot>
</template>
