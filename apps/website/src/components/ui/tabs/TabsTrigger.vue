<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui'
import { TabsTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  TabsTriggerProps & { class?: HTMLAttributes['class'] }
>()

const forwarded = useForwardProps(computed(() => ({ ...restProps })))
</script>

<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-primary-warm-gray transition-colors outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-transparency-white-t8 data-[state=active]:text-primary-warm-white [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
