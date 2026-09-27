<script setup lang="ts">
import type { NavigationMenuViewportProps } from 'reka-ui'
import { NavigationMenuViewport, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NavigationMenuViewportProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(computed(() => ({ ...restProps })))
</script>

<template>
  <div class="absolute top-full left-0 isolate z-50 flex justify-center">
    <NavigationMenuViewport
      data-slot="navigation-menu-viewport"
      v-bind="forwardedProps"
      :class="
        cn(
          'origin-top-center bg-primary-comfy-ink-light border-primary-comfy-ink-light relative left-(--reka-navigation-menu-viewport-left) mt-1.5 h-(--reka-navigation-menu-viewport-height) w-full overflow-hidden rounded-3xl border text-primary-comfy-canvas shadow-sm data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:zoom-in-90 md:w-(--reka-navigation-menu-viewport-width)',
          className
        )
      "
    />
  </div>
</template>
