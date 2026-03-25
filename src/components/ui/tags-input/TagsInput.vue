<script setup lang="ts" generic="T extends AcceptableInputValue = string">
import { onClickOutside, useCurrentElement } from '@vueuse/core'
import type {
  AcceptableInputValue,
  TagsInputRootEmits,
  TagsInputRootProps
} from 'reka-ui'
import { TagsInputRoot, useForwardPropsEmits } from 'reka-ui'
import { computed, nextTick, provide, ref } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { tagsInputFocusKey, tagsInputIsEditingKey } from './tagsInputContext'
import type { FocusCallback } from './tagsInputContext'

const {
  disabled = false,
  alwaysEditing = false,
  class: className,
  ...restProps
} = defineProps<
  TagsInputRootProps<T> & {
    class?: HTMLAttributes['class']
    alwaysEditing?: boolean
  }
>()
const emits = defineEmits<TagsInputRootEmits<T>>()

const isEditing = ref(false)
const rootEl = useCurrentElement<HTMLElement>()
const focusInput = ref<FocusCallback>()

provide(tagsInputFocusKey, (callback: FocusCallback) => {
  focusInput.value = callback
})
const isEditingEnabled = computed(() => alwaysEditing || isEditing.value)
provide(tagsInputIsEditingKey, isEditingEnabled)

const internalDisabled = computed(() => disabled || !isEditingEnabled.value)

const delegatedProps = computed(() => ({
  ...restProps,
  disabled: internalDisabled.value
}))

const forwarded = useForwardPropsEmits(delegatedProps, emits)

async function enableEditing() {
  if (!disabled && !alwaysEditing && !isEditing.value) {
    isEditing.value = true
    await nextTick()
    focusInput.value?.()
  }
}

onClickOutside(rootEl, () => {
  if (!alwaysEditing) {
    isEditing.value = false
  }
})
</script>

<template>
  <TagsInputRoot
    v-slot="{ modelValue }"
    v-bind="forwarded"
    :class="
      cn(
        'group relative flex flex-wrap items-center gap-2 rounded-lg bg-transparent p-2 text-xs text-base-foreground',
        !internalDisabled &&
          'focus-within:bg-modal-card-background-hovered hover:bg-modal-card-background-hovered',
        !disabled && !isEditingEnabled && 'cursor-pointer',
        className
      )
    "
    @click="enableEditing"
  >
    <slot :is-empty="modelValue.length === 0" />
    <i
      v-if="!disabled && !isEditingEnabled"
      aria-hidden="true"
      class="absolute right-2 bottom-2 icon-[lucide--square-pen] size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
    />
  </TagsInputRoot>
</template>
