<script setup lang="ts">
import type { TagsInputItemProps } from 'reka-ui'
import {
  injectTagsInputRootContext,
  TagsInputItem,
  useForwardProps
} from 'reka-ui'
import { nextTick, ref } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className, ...restProps } = defineProps<
  TagsInputItemProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)
const context = injectTagsInputRootContext()
const itemRef = ref<InstanceType<typeof TagsInputItem>>()

function handleClick() {
  if (context.disabled.value) return
  const el = itemRef.value?.$el
  if (!el) return
  context.selectedElement.value = el
  // Refocus the input so keyboard events (Delete/Backspace/arrows) flow through reka-ui's handler
  void nextTick(() => {
    const root = el.closest('[dir]')
    const input = root?.querySelector('input')
    input?.focus()
  })
}
</script>

<template>
  <TagsInputItem
    ref="itemRef"
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-6 items-center gap-1 rounded-sm bg-modal-card-tag-background py-1 pr-1 pl-2 text-modal-card-tag-foreground ring-offset-base-background backdrop-blur-sm data-[state=active]:ring-2 data-[state=active]:ring-base-foreground data-[state=active]:ring-offset-1',
        className
      )
    "
    @click="handleClick"
  >
    <slot />
  </TagsInputItem>
</template>
