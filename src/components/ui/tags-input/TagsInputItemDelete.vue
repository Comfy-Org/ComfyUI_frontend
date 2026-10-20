<script setup lang="ts">
import type { TagsInputItemDeleteProps } from 'reka-ui'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import TagRemoveButton from '@/components/chip/TagRemoveButton.vue'

const {
  class: className,
  removeLabel,
  ...restProps
} = defineProps<
  TagsInputItemDeleteProps & {
    class?: HTMLAttributes['class']
    removeLabel: string
  }
>()

const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <TagsInputItemDelete
    v-bind="forwardedProps"
    :as="TagRemoveButton"
    :label="removeLabel"
    :class="className"
  >
    <slot>
      <i class="icon-[lucide--x] size-4" />
    </slot>
  </TagsInputItemDelete>
</template>
