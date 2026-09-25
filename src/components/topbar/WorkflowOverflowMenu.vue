<template>
  <div class="shrink-0 self-center">
    <Button
      v-tooltip="{ value: $t('g.moreWorkflows'), showDelay: 300 }"
      class="rounded-lg"
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('g.moreWorkflows')"
      @click="menu?.toggle($event)"
    >
      <i class="pi pi-ellipsis-h" />
    </Button>
    <Menu ref="menu" :model="menuItems" class="max-h-[40vh] overflow-auto">
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
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

import WorkflowAgentTargetIndicator from './WorkflowAgentTargetIndicator.vue'

const props = defineProps<{
  workflows: ComfyWorkflow[]
  activeWorkflow: ComfyWorkflow | null
}>()

const menu = ref<InstanceType<typeof Menu> | null>(null)
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
