<template>
  <div class="shrink-0 self-center">
    <Menu :items="menuItems" max-height="viewport">
      <template #trigger>
        <Tooltip
          :config="{ value: $t('g.moreWorkflows'), showDelay: 300 }"
          side="right"
        >
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('g.moreWorkflows')"
            icon="icon-[lucide--ellipsis]"
          />
        </Tooltip>
      </template>
      <template #item="{ item }">
        <i v-if="item.icon" :class="item.icon" />
        <WorkflowAgentTargetIndicator
          v-if="item.key"
          :workflow-path="item.key"
        />
        <span>{{ item.label }}</span>
      </template>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

import WorkflowAgentTargetIndicator from './WorkflowAgentTargetIndicator.vue'

const props = defineProps<{
  workflows: ComfyWorkflow[]
  activeWorkflow: ComfyWorkflow | null
}>()

const workflowService = useWorkflowService()

const menuItems = computed(() =>
  props.workflows.map((workflow: ComfyWorkflow) => ({
    label: workflow.filename,
    key: workflow.path,
    icon:
      props.activeWorkflow?.key === workflow.key ? 'pi pi-check' : undefined,
    command: () => {
      void workflowService.openWorkflow(workflow)
    }
  }))
)
</script>
