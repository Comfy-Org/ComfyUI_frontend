<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

const {
  class: className,
  placeholder,
  ariaLabel
} = defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
  ariaLabel?: string
}>()

const model = defineModel<string>({ default: '' })

const isComposing = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || isComposing.value) return
  event.preventDefault()
  const form = (event.target as HTMLElement).closest('form')
  form?.requestSubmit()
}

function focus() {
  const el = textareaEl.value
  if (!el) return
  el.focus()
  el.setSelectionRange(el.value.length, el.value.length)
}

function getSelectionStart(): number {
  return textareaEl.value?.selectionStart ?? 0
}

defineExpose({ focus, getSelectionStart })
</script>

<template>
  <textarea
    ref="textareaEl"
    v-model="model"
    rows="1"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
    :class="
      cn(
        'field-sizing-content max-h-48 min-h-20 w-full resize-none border-none bg-transparent px-4 pt-2 pb-3 font-[inherit] text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none',
        className
      )
    "
    @keydown="onKeydown"
    @compositionstart="isComposing = true"
    @compositionend="isComposing = false"
  />
</template>
