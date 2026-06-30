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
  >
    <slot />
  </div>
</template>
