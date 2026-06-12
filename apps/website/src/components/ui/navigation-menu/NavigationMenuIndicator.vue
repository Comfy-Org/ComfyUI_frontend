<script setup lang="ts">
import type { NavigationMenuIndicatorProps } from 'reka-ui'
import { NavigationMenuIndicator, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NavigationMenuIndicatorProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(computed(() => ({ ...restProps })))
</script>

<template>
  <NavigationMenuIndicator
    data-slot="navigation-menu-indicator"
    v-bind="forwardedProps"
    :class="
      cn(
        'top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in',
        className
      )
    "
  >
    <div
      class="bg-border relative top-[60%] size-2 rotate-45 rounded-tl-sm shadow-md"
    />
  </NavigationMenuIndicator>
</template>
