<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'

import type { PromptInputFocusedContext } from './promptInputContext'
import { PROMPT_INPUT_FOCUSED_KEY } from './promptInputContext'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const isFocused = inject<PromptInputFocusedContext>(PROMPT_INPUT_FOCUSED_KEY)

function onFocusIn() {
  if (isFocused) isFocused.value = true
}

function onFocusOut(e: FocusEvent) {
  const current = e.currentTarget as HTMLElement | null
  if (isFocused && !current?.contains(e.relatedTarget as Node)) {
    isFocused.value = false
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col rounded-2xl border bg-secondary-background transition-colors',
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
