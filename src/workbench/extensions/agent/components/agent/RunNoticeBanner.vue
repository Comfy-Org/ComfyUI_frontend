<script setup lang="ts">
import { useStorage } from '@vueuse/core'

const { expanded = false, workflowName } = defineProps<{
  expanded?: boolean
  workflowName?: string
}>()

const dismissed = useStorage('Comfy.AgentPanel.runNoticeDismissed', false)
</script>

<template>
  <div
    v-if="!dismissed"
    role="note"
    class="bg-agent-surface before:bg-agent-accent relative flex items-start gap-2 overflow-hidden rounded-lg p-4 shadow-[0_0_1px_var(--color-smoke-200)] before:absolute before:inset-y-0 before:left-0 before:w-1"
  >
    <span
      class="text-agent-accent icon-[heroicons--information-circle-20-solid] size-5 shrink-0"
    />
    <p class="text-agent-fg my-0 min-w-0 flex-1 text-sm font-medium">
      {{
        workflowName
          ? $t('agent.workflowEditNotice', { workflow: workflowName })
          : $t(expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice')
      }}
    </p>
    <button
      type="button"
      :aria-label="$t('agent.dismiss')"
      class="text-agent-fg-muted hover:text-agent-fg flex size-5 shrink-0 cursor-pointer items-center justify-center p-0"
      @click="dismissed = true"
    >
      <span class="icon-[lucide--x] size-5" />
    </button>
  </div>
</template>
