<script setup lang="ts">
import { onClickOutside, useCurrentElement } from '@vueuse/core'
import type { TagsInputRootEmits, TagsInputRootProps } from 'reka-ui'
import { TagsInputRoot, useForwardPropsEmits } from 'reka-ui'
import { computed, nextTick, provide, ref } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { tagsInputFocusKey } from './tagsInputContext'
import type { FocusCallback } from './tagsInputContext'

const {
  disabled = false,
  class: className,
  ...restProps
} = defineProps<TagsInputRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<TagsInputRootEmits>()

const isEditing = ref(false)
const rootEl = useCurrentElement<HTMLElement>()
const focusInput = ref<FocusCallback>()

provide(tagsInputFocusKey, (callback: FocusCallback) => {
  focusInput.value = callback
})

const internalDisabled = computed(() => disabled || !isEditing.value)

const delegatedProps = computed(() => ({
  ...restProps,
  disabled: internalDisabled.value
}))

const forwarded = useForwardPropsEmits(delegatedProps, emits)

async function enableEditing() {
  if (!disabled && !isEditing.value) {
    isEditing.value = true
    await nextTick()
    focusInput.value?.()
  }
}

onClickOutside(rootEl, () => {
  isEditing.value = false
})
</script>

<template>
  <TagsInputRoot
    v-bind="forwarded"
    :class="
      cn(
        'group relative flex flex-wrap items-center gap-2 rounded-lg bg-transparent p-2 text-xs text-base-foreground',
        !internalDisabled &&
          'hover:bg-modal-card-background-hovered focus-within:bg-modal-card-background-hovered',
        !disabled && !isEditing && 'cursor-pointer',
        className
      )
    "
    @click="enableEditing"
  >
    <slot />
    <i
      v-if="!disabled && !isEditing"
      class="icon-[lucide--square-pen] absolute bottom-2 right-2 size-4 text-muted-foreground"
    />
  </TagsInputRoot>
</template>
