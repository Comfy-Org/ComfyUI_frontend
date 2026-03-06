<script setup lang="ts">
import type { TagsInputItemProps } from 'reka-ui'
import { TagsInputItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className, ...restProps } = defineProps<
  TagsInputItemProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <TagsInputItem
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-6 items-center gap-1 rounded-sm bg-modal-card-tag-background py-1 pr-1 pl-2 text-modal-card-tag-foreground ring-offset-base-background backdrop-blur-sm data-[state=active]:ring-2 data-[state=active]:ring-base-foreground data-[state=active]:ring-offset-1',
        className
      )
    "
  >
    <slot />
  </TagsInputItem>
</template>
