<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { inject, ref } from 'vue'

import type { PromptInputFocusedContext } from './promptInputContext'
import { PROMPT_INPUT_FOCUSED_KEY } from './promptInputContext'

const { class: className, placeholder } = defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
}>()

const model = defineModel<string>({ default: '' })

const isComposing = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const isFocused = inject<PromptInputFocusedContext>(PROMPT_INPUT_FOCUSED_KEY)

function onFocus() {
  if (isFocused) isFocused.value = true
}

function onBlur() {
  if (isFocused) isFocused.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || isComposing.value) return
  event.preventDefault()
  const form = (event.target as HTMLElement).closest('form')
  form?.requestSubmit()
}

defineExpose({ focus: () => textareaEl.value?.focus() })
</script>

<template>
  <textarea
    ref="textareaEl"
    v-model="model"
    rows="1"
    :placeholder="placeholder"
    :class="
      cn(
        'field-sizing-content max-h-48 min-h-20 w-full resize-none border-none bg-transparent px-4 py-3 font-[inherit] text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none',
        className
      )
    "
    @focus="onFocus"
    @blur="onBlur"
    @keydown="onKeydown"
    @compositionstart="isComposing = true"
    @compositionend="isComposing = false"
  />
</template>
