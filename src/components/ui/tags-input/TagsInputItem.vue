<script setup lang="ts">
import type { TagsInputItemProps } from 'reka-ui'
import { TagsInputItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { tagVariants } from '@/components/chip/tag.variants'

const { class: className, ...restProps } = defineProps<
  TagsInputItemProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)
</script>

<template>
  <TagsInputItem
    v-bind="forwardedProps"
    :class="cn(tagVariants({ removable: true }), className)"
  >
    <slot />
  </TagsInputItem>
</template>
