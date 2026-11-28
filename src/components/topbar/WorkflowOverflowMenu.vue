<template>
  <div class="shrink-0 self-center">
    <Menu :items="menuItems" max-height="viewport">
      <template #trigger>
        <Button
          :tooltip="$t('g.moreWorkflows')"
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('g.moreWorkflows')"
          icon="icon-[lucide--ellipsis]"
        />
      </template>
      <template #item="{ item }">
        <i v-if="item.icon" :class="item.icon" />
        <WorkflowTabStatus
          v-if="item.key"
          :status="statusByPath.get(item.key)"
          :reserve-space="false"
        />
        <span>{{ item.label }}</span>
      </template>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ResolvedTabPrimaryStatus } from './workflowTabStatus'
import { resolvePrimaryTabStatus } from './workflowTabStatus'
import WorkflowTabStatus from './WorkflowTabStatus.vue'

const props = defineProps<{
  workflows: ComfyWorkflow[]
  activeWorkflow: ComfyWorkflow | null
}>()

const { t } = useI18n()
const workflowService = useWorkflowService()
const executionStore = useExecutionStore()
const tabActivity = useWorkflowTabActivityStore()

const statusByPath = computed(() => {
  const statuses = new Map<string, ResolvedTabPrimaryStatus | undefined>()
  for (const workflow of props.workflows) {
    const isActive = props.activeWorkflow?.key === workflow.key
    statuses.set(
      workflow.path,
      resolvePrimaryTabStatus({
        awaitingApproval: tabActivity.awaitingApprovalPaths.has(workflow.path),
        agentWorking: tabActivity.editingPaths.has(workflow.path),
        agentReplied: tabActivity.unseenModifiedPaths.has(workflow.path),
        workflowStatus: isActive
          ? undefined
          : executionStore.getWorkflowStatus(workflow)
      })
    )
  }
  return statuses
})

const menuItems = computed(() =>
  props.workflows.map((workflow: ComfyWorkflow) => {
    const status = statusByPath.value.get(workflow.path)
    return {
      label: workflow.filename,
      ariaLabel: status
        ? `${workflow.filename}, ${t(status.labelKey)}`
        : undefined,
      key: workflow.path,
      icon:
        props.activeWorkflow?.key === workflow.key
          ? 'icon-[lucide--check]'
          : undefined,
      command: () => {
        void workflowService.openWorkflow(workflow, { initiator: 'user' })
      }
    }
  })
)
</script>
