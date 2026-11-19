<script setup lang="ts">
import type { TagsInputItemDeleteProps } from 'reka-ui'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import TagRemoveButton from '@comfyorg/design-system/chip/TagRemoveButton'

const { class: className, ...restProps } = defineProps<
  TagsInputItemDeleteProps & {
    class?: HTMLAttributes['class']
  }
>()

const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <TagsInputItemDelete
    v-bind="forwardedProps"
    :as="TagRemoveButton"
    :aria-labelledby="undefined"
    :class="className"
  >
    <slot>
      <i class="icon-[lucide--x]" />
    </slot>
  </TagsInputItemDelete>
</template>
