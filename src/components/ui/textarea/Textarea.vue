<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useTemplateRef } from 'vue'

import { cn } from '@/utils/tailwindUtil'

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
    :class="
      cn(
        'flex min-h-16 w-full rounded-lg border-none bg-secondary-background px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        className
      )
    "
  />
</template>
