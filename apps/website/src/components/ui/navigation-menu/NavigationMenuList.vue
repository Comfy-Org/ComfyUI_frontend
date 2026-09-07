<script setup lang="ts">
import type { NavigationMenuListProps } from 'reka-ui'
import { NavigationMenuList, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NavigationMenuListProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(computed(() => ({ ...restProps })))
</script>

<template>
  <NavigationMenuList
    data-slot="navigation-menu-list"
    v-bind="forwardedProps"
    :class="
      cn(
        'group flex flex-1 list-none items-center justify-center gap-1',
        className
      )
    "
  >
    <slot />
  </NavigationMenuList>
</template>
