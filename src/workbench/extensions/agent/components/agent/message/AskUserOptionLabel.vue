<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { AskUserOption } from '../../../services/agent/agentMessageParts'

const {
  optionId,
  option,
  disabled = false
} = defineProps<{
  optionId: string
  option: AskUserOption
  disabled?: boolean
}>()
</script>

<template>
  <label
    :for="optionId"
    :class="
      cn(
        'flex min-w-0 flex-1 cursor-pointer flex-col',
        disabled && 'cursor-not-allowed opacity-50'
      )
    "
  >
    <span
      :id="`${optionId}-label`"
      class="wrap-break-word text-base-foreground"
    >
      {{ option.label }}
    </span>
    <span
      v-if="option.description"
      :id="`${optionId}-description`"
      class="text-xs/5 wrap-break-word text-muted-foreground"
    >
      {{ option.description }}
    </span>
  </label>
</template>
