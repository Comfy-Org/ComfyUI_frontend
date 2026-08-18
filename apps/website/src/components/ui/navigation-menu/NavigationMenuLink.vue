<script setup lang="ts">
import type { NavigationMenuLinkEmits, NavigationMenuLinkProps } from 'reka-ui'
import { NavigationMenuLink, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className, ...restProps } = defineProps<
  NavigationMenuLinkProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<NavigationMenuLinkEmits>()

const forwarded = useForwardPropsEmits(
  computed(() => ({ ...restProps })),
  emits
)
</script>

<template>
  <NavigationMenuLink
    data-slot="navigation-menu-link"
    v-bind="forwarded"
    :class="
      cn(
        'data-active:text-primary-comfy-yellow focus:bg-transparency-white-t4 ring-primary-comfy-yellow outline-primary-comfy-yellow flex flex-col gap-1 rounded-xl p-2 text-sm transition-[color,box-shadow] hover:text-white focus:text-white focus-visible:ring-4 focus-visible:outline-1 data-active:bg-transparent data-active:hover:bg-transparent [&_svg:not([class*=\'size-\'])]:size-4 [&_svg:not([class*=\'text-\'])]:text-muted-foreground',
        className
      )
    "
  >
    <slot />
  </NavigationMenuLink>
</template>
