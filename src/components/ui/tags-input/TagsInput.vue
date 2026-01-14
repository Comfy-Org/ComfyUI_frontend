<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputRootEmits, TagsInputRootProps } from 'reka-ui'
import { TagsInputRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<TagsInputRootEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TagsInputRoot
    v-bind="forwarded"
    :class="
      cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-secondary-background-hover bg-base-background px-3 py-1.5 text-sm text-base-foreground focus-within:ring-1 focus-within:ring-primary-background',
        props.class
      )
    "
  >
    <slot />
  </TagsInputRoot>
</template>
