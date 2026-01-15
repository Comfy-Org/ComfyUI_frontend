<script setup lang="ts">
import type { TagsInputInputProps } from 'reka-ui'
import { TagsInputInput, useForwardExpose, useForwardProps } from 'reka-ui'
import { inject, onMounted, onUnmounted } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { tagsInputFocusKey } from './tagsInputContext'

const { class: className, ...restProps } = defineProps<
  TagsInputInputProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)

const { forwardRef, currentElement } = useForwardExpose()
const registerFocus = inject(tagsInputFocusKey, undefined)

onMounted(() => {
  registerFocus?.(() => currentElement.value?.focus())
})

onUnmounted(() => {
  registerFocus?.(undefined)
})
</script>

<template>
  <TagsInputInput
    :ref="forwardRef"
    v-bind="forwardedProps"
    :class="
      cn(
        'min-h-6 flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none appearance-none border-none group-data-[disabled]:hidden',
        className
      )
    "
  />
</template>
