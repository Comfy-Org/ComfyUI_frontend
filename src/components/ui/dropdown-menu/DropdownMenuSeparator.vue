<script setup lang="ts">
import type { DropdownMenuSeparatorProps } from 'reka-ui'
import { DropdownMenuSeparator, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuSeparatorClasses } from '../menu.styles'

const { class: className, ...restProps } = defineProps<
  DropdownMenuSeparatorProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = computed(() => ({ ...restProps }))
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuSeparator
    v-bind="forwarded"
    :class="cn(menuSeparatorClasses, className)"
  />
</template>
