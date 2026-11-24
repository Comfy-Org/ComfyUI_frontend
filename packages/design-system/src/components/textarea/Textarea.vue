<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { textareaClass } from './textarea.styles'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()

const textareaEl = useTemplateRef<HTMLTextAreaElement>('textareaEl')

defineExpose({
  focus: () => textareaEl.value?.focus()
})
</script>

<template>
  <textarea
    ref="textareaEl"
    v-model="modelValue"
    :class="cn(textareaClass, className)"
  />
</template>
