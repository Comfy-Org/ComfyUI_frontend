<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAgentTargetNavigation } from '../../../composables/agent/useAgentTargetNavigation'
import { useAgentPanelStore } from '../../../stores/agent/agentPanelStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { reportError } from '@/platform/telemetry/reportError'
import { useAgentWorkflowTabBindingStore } from '../../../stores/agent/agentWorkflowTabBindingStore'
import { AgentTargetNavigationError } from '../../../services/agent/targetAwareAgentNavigation'

const { workflowId, locatorId, name } = defineProps<{
  workflowId: string
  locatorId?: string
  name?: string
}>()

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const bindingStore = useAgentWorkflowTabBindingStore()
const toast = useToastStore()
const { enabled: agentEnabled } = storeToRefs(useAgentPanelStore())
const targetNavigation = useAgentTargetNavigation()

const tab = computed(() => {
  const path = bindingStore.tabPathFor(workflowId)
  return path === undefined
    ? undefined
    : workflowStore.openWorkflows.find((open) => open.path === path)
})

const label = computed(() => name || tab.value?.filename)

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
  if (!target) return
  if (locatorId === undefined) await workflowService.openWorkflow(target)
  else {
    try {
      await targetNavigation.navigate({ workflowId, locatorId })
    } catch (error) {
      if (!(error instanceof AgentTargetNavigationError))
        reportError(error, { errorType: 'agent_target_navigation_failure' })
      toast.add({
        severity: 'warn',
        detail: t('agent.targetNavigationUnavailable'),
        life: 5000
      })
    }
  }
}
</script>

<template>
  <button
    v-if="agentEnabled && tab"
    type="button"
    :aria-label="t('agent.openWorkflowTab', { name: label })"
    :aria-describedby="nodeCount === undefined ? undefined : nodeCountId"
    class="border-agent-border hover:bg-agent-surface-hover flex h-[53px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors"
    @click="open"
  >
    <span
      aria-hidden="true"
      data-testid="workflow-link-media"
      class="border-agent-border bg-agent-surface-raised text-agent-fg-subtle flex size-8 shrink-0 items-center justify-center rounded-md border"
    >
      <span class="icon-[comfy--workflow] size-4" />
    </span>
    <span
      data-testid="workflow-link-content"
      class="flex min-w-0 flex-1 flex-col gap-0.5"
    >
      <span class="text-agent-fg truncate text-sm/4 font-medium">{{
        label
      }}</span>
      <span
        v-if="nodeCount !== undefined"
        :id="nodeCountId"
        class="text-agent-fg-subtle text-xs"
      >
        {{ t('g.nodesCount', nodeCount) }}
      </span>
    </span>
    <span
      aria-hidden="true"
      data-testid="workflow-link-navigation"
      class="text-agent-fg-subtle icon-[lucide--arrow-right] size-4 shrink-0"
    />
  </button>
</template>
