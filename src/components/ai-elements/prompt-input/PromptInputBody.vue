<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const isFocused = ref(false)

function onFocusIn() {
  isFocused.value = true
}

function onFocusOut(event: FocusEvent) {
  const current = event.currentTarget as HTMLElement | null
  if (!current?.contains(event.relatedTarget as Node)) {
    isFocused.value = false
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col rounded-2xl border bg-base-background transition-colors',
        isFocused ? 'border-muted-foreground' : 'border-border-default',
        className
      )
    "
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <slot />
  </div>
</template>
