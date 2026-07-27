<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentWorkflowTabBindingStore } from '../../../stores/agent/agentWorkflowTabBindingStore'

const { workflowId, name } = defineProps<{
  workflowId: string
  name?: string
}>()

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const bindingStore = useAgentWorkflowTabBindingStore()

const tab = computed(() => {
  const path = bindingStore.tabPathFor(workflowId)
  return path === undefined
    ? undefined
    : workflowStore.openWorkflows.find((open) => open.path === path)
})

const label = computed(() => tab.value?.filename || name)

async function open(): Promise<void> {
  const target = tab.value
  if (target) await workflowService.openWorkflow(target)
}
</script>

<template>
  <button
    v-if="tab"
    type="button"
    :aria-label="t('agent.openWorkflowTab', { name: label })"
    class="rounded-agent border-agent-border bg-agent-surface-raised hover:bg-agent-surface-hover flex w-full cursor-pointer items-center gap-2 border px-3 py-2 text-left transition-colors"
    @click="open"
  >
    <span
      class="text-agent-fg-subtle icon-[lucide--panels-top-left] size-4 shrink-0"
    />
    <span class="text-agent-fg min-w-0 truncate text-xs">{{ label }}</span>
    <span
      class="text-agent-fg-subtle ml-auto icon-[lucide--arrow-right] size-4 shrink-0"
    />
  </button>
</template>
