<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TabChatStatus } from '@/stores/workflowTabActivityStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

const { workflowPath } = defineProps<{ workflowPath: string }>()

const { t } = useI18n()
const tabActivity = useWorkflowTabActivityStore()
const status = computed(() => tabActivity.chatStatusFor(workflowPath))

const LABEL_KEYS: Record<TabChatStatus, string> = {
  waiting: 'g.agentNeedsApproval',
  'in-progress': 'g.agentWorking',
  unseen: 'g.agentModified',
  seen: 'g.agentChat'
}

const DOT_COLORS: Record<Exclude<TabChatStatus, 'in-progress'>, string> = {
  waiting: 'bg-warning',
  unseen: 'bg-success',
  seen: 'bg-muted-foreground'
}
</script>

<template>
  <span
    v-if="status"
    class="inline-flex size-3.5 shrink-0 items-center justify-center"
  >
    <i
      v-if="status === 'in-progress'"
      role="img"
      :aria-label="t(LABEL_KEYS[status])"
      data-testid="workflow-chat-status"
      :data-status="status"
      class="icon-[lucide--loader-circle] size-3 text-muted-foreground motion-safe:animate-spin"
    />
    <span
      v-else
      role="img"
      :aria-label="t(LABEL_KEYS[status])"
      data-testid="workflow-chat-status"
      :data-status="status"
      :class="cn('size-2 rounded-full', DOT_COLORS[status])"
    />
  </span>
</template>
