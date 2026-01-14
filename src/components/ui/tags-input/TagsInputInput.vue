<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputInputProps } from 'reka-ui'
import { TagsInputInput, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputInputProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputInput
    v-bind="forwardedProps"
    :class="
      cn(
        'min-h-6 flex-1 bg-transparent px-1 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none',
        props.class
      )
    "
  />
</template>
