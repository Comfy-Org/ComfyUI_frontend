<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useTemplateRef } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()

const inputRef = useTemplateRef<HTMLInputElement>('inputEl')

defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select()
})
</script>

<template>
  <input
    ref="inputEl"
    v-model="modelValue"
    :class="
      cn(
        'flex h-10 w-full min-w-0 appearance-none rounded-lg border-none bg-secondary-background px-4 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        className
      )
    "
  />
</template>
