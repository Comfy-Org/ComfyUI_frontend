<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { inputClass } from '#control-styles'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()

const inputRef = useTemplateRef<HTMLInputElement>('inputEl')

defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select(),
  blur: () => inputRef.value?.blur(),
  setSelectionRange: (start: number, end: number) =>
    inputRef.value?.setSelectionRange(start, end),
  selectAll: () =>
    inputRef.value?.setSelectionRange(0, inputRef.value.value.length)
})
</script>

<template>
  <input
    ref="inputEl"
    v-model="modelValue"
    :class="cn(inputClass, className)"
  />
</template>
