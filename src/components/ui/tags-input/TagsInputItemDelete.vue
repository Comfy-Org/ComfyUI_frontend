<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputItemDeleteProps } from 'reka-ui'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputItemDeleteProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputItemDelete
    v-bind="forwardedProps"
    :class="
      cn(
        'mr-1 flex rounded bg-transparent text-muted-foreground transition-colors hover:text-base-foreground focus:outline-none',
        props.class
      )
    "
  >
    <slot>
      <i class="icon-[lucide--x] size-3.5" />
    </slot>
  </TagsInputItemDelete>
</template>
