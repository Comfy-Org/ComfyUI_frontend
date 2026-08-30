<script setup lang="ts">
import type { TabsRootEmits, TabsRootProps } from 'reka-ui'
import { TabsRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  TabsRootProps & { class?: HTMLAttributes['class'] }
>()
const emit = defineEmits<TabsRootEmits>()
const forwarded = useForwardPropsEmits(restProps, emit)
</script>

<template>
  <TabsRoot v-bind="forwarded" :class="cn('flex flex-col', className)">
    <slot />
  </TabsRoot>
</template>
