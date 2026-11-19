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
        <WorkflowTabChatStatus v-if="item.key" :workflow-path="item.key" />
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
import {
  TAB_CHAT_STATUS_I18N_KEYS,
  useWorkflowTabActivityStore
} from '@/stores/workflowTabActivityStore'

import WorkflowTabChatStatus from './WorkflowTabChatStatus.vue'

const props = defineProps<{
  workflows: ComfyWorkflow[]
  activeWorkflow: ComfyWorkflow | null
}>()

const { t } = useI18n()
const workflowService = useWorkflowService()
const tabActivity = useWorkflowTabActivityStore()

const menuItems = computed(() =>
  props.workflows.map((workflow: ComfyWorkflow) => {
    const status = tabActivity.chatStatusFor(workflow.path)
    return {
      label: workflow.filename,
      ariaLabel: status
        ? `${workflow.filename}, ${t(TAB_CHAT_STATUS_I18N_KEYS[status])}`
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
