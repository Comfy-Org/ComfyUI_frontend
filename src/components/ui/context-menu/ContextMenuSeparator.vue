<script setup lang="ts">
/* eslint-disable vue/no-unused-properties */
import type { ContextMenuSeparatorProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ContextMenuSeparator } from 'reka-ui'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  ContextMenuSeparatorProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <ContextMenuSeparator
    v-bind="delegatedProps"
    :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
  />
</template>
