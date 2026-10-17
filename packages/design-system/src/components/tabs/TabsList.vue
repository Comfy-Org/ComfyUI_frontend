<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TabsListProps } from 'reka-ui'
import { TabsList, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { TabsListVariants } from './tabs.variants'
import { tabsListVariants } from './tabs.variants'

const props = defineProps<
  TabsListProps & {
    class?: HTMLAttributes['class']
    variant?: TabsListVariants['variant']
  }
>()
const forwarded = useForwardProps(reactiveOmit(props, 'class', 'variant'))
</script>

<template>
  <TabsList
    v-bind="forwarded"
    data-slot="tabs-list"
    :class="cn(tabsListVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </TabsList>
</template>
