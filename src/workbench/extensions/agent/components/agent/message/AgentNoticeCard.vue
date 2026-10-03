<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { NoticePart } from '../../../services/agent/agentMessageParts'

const { part } = defineProps<{ part: NoticePart }>()
</script>

<template>
  <div
    :role="part.level === 'error' ? 'alert' : 'status'"
    :class="
      cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
        part.level === 'error'
          ? 'border-destructive-background/40 text-destructive-background'
          : 'border-component-node-border text-muted-foreground'
      )
    "
  >
    <span class="mt-0.5 icon-[lucide--triangle-alert] size-4 shrink-0" />
    <span class="flex flex-col gap-0.5">
      <span>{{ part.text }}</span>
      <span
        v-if="part.retryAfterSeconds !== undefined"
        class="text-xs text-muted-foreground"
      >
        {{
          $t('agent.retryAfterSeconds', {
            seconds: part.retryAfterSeconds
          })
        }}
      </span>
    </span>
  </div>
</template>
