<template>
  <Button
    variant="outline"
    size="sm"
    :class="
      cn(
        'group no-drag shrink-0 gap-1 rounded-lg',
        active && 'bg-accent',
        inviting && !active && !comfyAgent && 'agent-shimmer-outline',
        comfyAgent && 'cursor-default opacity-50'
      )
    "
    :aria-pressed="active"
    :aria-disabled="comfyAgent !== undefined || undefined"
    :title="
      comfyAgent?.state === 'failed'
        ? $t('agent.entryFailedReason', {
            reason: comfyAgent.reason ?? 'unknown'
          })
        : comfyAgent?.reason
          ? $t('agent.entryStartingReason', { reason: comfyAgent.reason })
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
import type { AgentServerFeature } from '@/workbench/extensions/agent/schemas/agentApiSchema'

const {
  active = false,
  inviting = false,
  comfyAgent
} = defineProps<{
  active?: boolean
  /** Draw attention to the button for a user who has never opened the panel. */
  inviting?: boolean
  /** ComfyUI's agent while it is not ready: shown, but inert. */
  comfyAgent?: AgentServerFeature
}>()
</script>
