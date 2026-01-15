<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TagsInputRootEmits, TagsInputRootProps } from 'reka-ui'
import { TagsInputRoot, useForwardPropsEmits } from 'reka-ui'
import { toRef } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<
  // eslint-disable-next-line vue/no-unused-properties
  TagsInputRootProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<TagsInputRootEmits>()

const disabled = toRef(props, 'disabled')
const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TagsInputRoot
    v-bind="forwarded"
    :class="
      cn(
        'group flex flex-wrap items-center gap-2 rounded-lg bg-transparent p-2 text-xs text-base-foreground',
        !disabled &&
          'hover:bg-modal-card-background-hovered focus-within:bg-modal-card-background-hovered',
        props.class
      )
    "
  >
    <slot />
  </TagsInputRoot>
</template>
