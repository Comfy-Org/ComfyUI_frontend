<script setup lang="ts">
import type { NavigationMenuItemProps } from 'reka-ui'
import { NavigationMenuItem } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NavigationMenuItemProps & { class?: HTMLAttributes['class'] }
>()
</script>

<template>
  <NavigationMenuItem
    data-slot="navigation-menu-item"
    v-bind="restProps"
    :class="cn('relative', className)"
  >
    <slot />
  </NavigationMenuItem>
</template>
