<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { NavigationMenuTriggerProps } from 'reka-ui'
import { NavigationMenuTrigger, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { navigationMenuTriggerStyle } from '.'

const { class: className, ...restProps } = defineProps<
  NavigationMenuTriggerProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(computed(() => ({ ...restProps })))
</script>

<template>
  <NavigationMenuTrigger
    data-slot="navigation-menu-trigger"
    v-bind="forwardedProps"
    :class="cn(navigationMenuTriggerStyle(), 'group', className)"
  >
    <slot />
    <ChevronDown
      class="relative ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuTrigger>
</template>
