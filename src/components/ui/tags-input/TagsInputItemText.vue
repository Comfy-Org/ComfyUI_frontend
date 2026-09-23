<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { TagsInputItemTextProps } from 'reka-ui'
import { TagsInputItemText, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

const { class: className, ...restProps } = defineProps<
  TagsInputItemTextProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <TagsInputItemText
    v-bind="forwardedProps"
    :class="cn('min-w-0 truncate bg-transparent text-xs', className)"
  />
</template>
