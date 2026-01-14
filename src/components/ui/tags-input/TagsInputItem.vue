<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputItemProps } from 'reka-ui'
import { TagsInputItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputItemProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputItem
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-6 items-center rounded-md bg-secondary-background text-base-foreground ring-offset-base-background data-[state=active]:ring-2 data-[state=active]:ring-primary-background data-[state=active]:ring-offset-1',
        props.class
      )
    "
  >
    <slot />
  </TagsInputItem>
</template>
