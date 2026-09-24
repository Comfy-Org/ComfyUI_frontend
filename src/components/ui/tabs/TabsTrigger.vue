<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TabsTriggerProps } from 'reka-ui'
import { TabsTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<
  TabsTriggerProps & { class?: HTMLAttributes['class'] }
>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    data-slot="tabs-trigger"
    :class="
      cn(
        'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-transparent px-2.5 text-sm whitespace-nowrap text-text-secondary transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-interface-menu-component-surface-hovered data-[state=active]:text-text-primary data-[state=inactive]:hover:bg-button-hover-surface',
        props.class
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
