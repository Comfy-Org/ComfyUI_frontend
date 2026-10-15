<script setup lang="ts">
import type {
  NavigationMenuRootEmits,
  NavigationMenuRootProps,
  NavigationMenuViewportProps
} from 'reka-ui'
import { NavigationMenuRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import NavigationMenuViewport from './NavigationMenuViewport.vue'

const {
  viewport = true,
  viewportAlign = 'center',
  class: className,
  ...restProps
} = defineProps<
  NavigationMenuRootProps & {
    class?: HTMLAttributes['class']
    viewport?: boolean
    /** Where an open panel lines up against its trigger. */
    viewportAlign?: NavigationMenuViewportProps['align']
  }
>()
const emits = defineEmits<NavigationMenuRootEmits>()

const forwarded = useForwardPropsEmits(
  computed(() => ({ ...restProps })),
  emits
)
</script>

<template>
  <NavigationMenuRoot
    v-slot="slotProps"
    data-slot="navigation-menu"
    :data-viewport="viewport"
    v-bind="forwarded"
    :class="
      cn(
        'group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
        className
      )
    "
  >
    <slot v-bind="slotProps" />
    <NavigationMenuViewport v-if="viewport" :align="viewportAlign" />
  </NavigationMenuRoot>
</template>
