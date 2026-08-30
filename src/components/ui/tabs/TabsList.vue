<script setup lang="ts">
import type { TabsListProps } from 'reka-ui'
import { TabsList, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  TabsListProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <TabsList
    v-bind="forwarded"
    :class="cn('inline-flex items-center text-muted-foreground', className)"
  >
    <slot />
  </TabsList>
</template>
