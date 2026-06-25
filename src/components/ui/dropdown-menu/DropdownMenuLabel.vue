<script setup lang="ts">
import type { DropdownMenuLabelProps } from 'reka-ui'
import { DropdownMenuLabel, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuLabelClasses } from '../menu.styles'

const { class: className, ...restProps } = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = computed(() => ({ ...restProps }))
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuLabel
    v-bind="forwarded"
    :class="cn(menuLabelClasses, className)"
  >
    <slot />
  </DropdownMenuLabel>
</template>
