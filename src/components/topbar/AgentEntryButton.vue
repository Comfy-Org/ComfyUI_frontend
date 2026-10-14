<template>
  <Button
    variant="outline"
    size="sm"
    :class="
      cn(
        'group no-drag shrink-0 gap-1 rounded-lg',
        active && 'bg-secondary-background-hover',
        inviting && !active && 'agent-shimmer-outline'
      )
    "
    :aria-pressed="active"
    :disabled="comfyAgent !== undefined"
    :title="
      comfyAgent?.state === 'failed'
        ? $t('agent.entryFailedReason', { reason: comfyAgent.reason })
        : undefined
    "
  >
    <i
      :class="
        cn(
          'size-3 transition-transform duration-300 ease-out group-hover:rotate-360 group-hover:duration-500 motion-reduce:transition-none',
          active ? 'icon-[comfy--astroid-filled]' : 'icon-[lucide--astroid]'
        )
      "
    />
    <span>{{
      comfyAgent?.state === 'starting'
        ? $t('agent.entryStarting')
        : comfyAgent?.state === 'failed'
          ? $t('agent.entryFailed')
          : $t('agent.entryButton')
    }}</span>
  </Button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { AgentStatusWsMessage } from '@/platform/remote/comfyui/execution/types'

const {
  active = false,
  inviting = false,
  comfyAgent
} = defineProps<{
  active?: boolean
  /** Draw attention to the button for a user who has never opened the panel. */
  inviting?: boolean
  /** ComfyUI's agent while it is not ready: shown, but not clickable. */
  comfyAgent?: AgentStatusWsMessage
}>()
</script>
