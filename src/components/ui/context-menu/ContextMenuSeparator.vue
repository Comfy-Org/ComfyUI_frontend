<script setup lang="ts">
import type { ContextMenuSeparatorProps } from 'reka-ui'
import { ContextMenuSeparator, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuSeparatorClasses } from '../menu.styles'

const { class: className, ...restProps } = defineProps<
  ContextMenuSeparatorProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = computed(() => ({ ...restProps }))
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ContextMenuSeparator
    v-bind="forwarded"
    :class="cn(menuSeparatorClasses, className)"
  />
</template>
