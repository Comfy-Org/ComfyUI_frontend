<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
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

const nodeCountId = useId()
const nodeCount = ref<number>()

watch(
  tab,
  (activeTab) => {
    nodeCount.value = activeTab?.activeState?.nodes?.length
  },
  { immediate: true }
)

useEventListener(
  api,
  'graphChanged',
  (event: CustomEvent<ComfyWorkflowJSON>) => {
    if (tab.value === workflowStore.activeWorkflow) {
      nodeCount.value = event.detail.nodes?.length
    }
  }
)

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
    :aria-describedby="nodeCount === undefined ? undefined : nodeCountId"
    class="rounded-agent border-agent-border hover:bg-agent-surface-hover flex w-full cursor-pointer items-center gap-2.5 border p-2.5 text-left transition-colors"
    @click="open"
  >
    <span
      class="border-agent-border text-agent-fg-subtle flex size-8 shrink-0 items-center justify-center rounded-md border"
    >
      <span class="icon-[lucide--folder] size-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="text-agent-fg block truncate text-sm">{{ label }}</span>
      <span
        v-if="nodeCount !== undefined"
        :id="nodeCountId"
        class="text-agent-fg-subtle block text-xs"
      >
        {{ t('g.nodesCount', nodeCount) }}
      </span>
    </span>
    <span
      class="text-agent-fg-subtle icon-[lucide--arrow-right] size-4 shrink-0"
    />
  </button>
</template>
