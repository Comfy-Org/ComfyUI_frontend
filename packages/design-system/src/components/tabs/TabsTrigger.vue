<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TabsTriggerProps } from 'reka-ui'
import { TabsTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { TabsTriggerVariants } from './tabs.variants'
import { tabsTriggerVariants } from './tabs.variants'

const props = defineProps<
  TabsTriggerProps & {
    class?: HTMLAttributes['class']
    variant?: TabsTriggerVariants['variant']
  }
>()
const forwarded = useForwardProps(reactiveOmit(props, 'class', 'variant'))
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    data-slot="tabs-trigger"
    :class="cn(tabsTriggerVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </TabsTrigger>
</template>
