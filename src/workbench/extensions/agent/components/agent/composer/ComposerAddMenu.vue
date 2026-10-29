<script setup lang="ts">
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@comfyorg/design-system/button/Button'
import MenuContent from '@comfyorg/design-system/menu/MenuContent'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import MenuSub from '@comfyorg/design-system/menu/MenuSub'
import MenuSubContent from '@comfyorg/design-system/menu/MenuSubContent'
import MenuSubTrigger from '@comfyorg/design-system/menu/MenuSubTrigger'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import type { WorkflowReferenceOption } from '@/workbench/extensions/agent/types/workflowReference'

const {
  canAttach,
  canOpenAssets,
  nodeReferenceDisabledReason,
  workflows,
  workflowSelecting,
  selectWorkflow
} = defineProps<{
  canAttach: boolean
  canOpenAssets: boolean
  nodeReferenceDisabledReason?: string
  workflows: WorkflowReferenceOption[]
  workflowSelecting: boolean
  selectWorkflow: (workflow: WorkflowReferenceOption) => Promise<boolean>
}>()
const emit = defineEmits<{
  selectNodes: [event: Event]
  attach: []
  openAssets: []
  requestWorkflowReferences: []
}>()
const { t } = useI18n()
const addMenuOpen = ref(false)
const workflowSubmenuOpen = ref(false)
function onWorkflowSubmenuOpenChange(open: boolean): void {
  if (open && !workflowSelecting) emit('requestWorkflowReferences')
}
async function pickWorkflow(workflow: WorkflowReferenceOption): Promise<void> {
  if (await selectWorkflow(workflow)) addMenuOpen.value = false
}
</script>

<template>
  <DropdownMenuRoot v-model:open="addMenuOpen">
    <DropdownMenuTrigger as-child>
      <Button
        :tooltip="t('agent.addToPrompt')"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('agent.addToPrompt')"
      >
        <i aria-hidden="true" class="icon-[lucide--plus]" />
      </Button>
    </DropdownMenuTrigger>
    <MenuContent
      side="top"
      align="start"
      :side-offset="4"
      width="compact"
      class="agent-scope"
    >
      <MenuItem
        v-if="canOpenAssets"
        class="mb-0.5"
        @select="emit('openAssets')"
      >
        <i aria-hidden="true" class="icon-[comfy--image-ai-edit]" />
        <span class="whitespace-nowrap">
          {{ t('agent.addFromAssets') }}
        </span>
      </MenuItem>
      <Tooltip :disabled="!nodeReferenceDisabledReason">
        <TooltipTrigger as-child>
          <MenuItem
            :disabled="!!nodeReferenceDisabledReason"
            :aria-description="nodeReferenceDisabledReason"
            @select="emit('selectNodes', $event)"
          >
            <i aria-hidden="true" class="icon-[comfy--node]" />
            <span class="whitespace-nowrap">
              {{ t('agent.nodes') }}
            </span>
          </MenuItem>
        </TooltipTrigger>
        <TooltipContent>{{ nodeReferenceDisabledReason }}</TooltipContent>
      </Tooltip>
      <MenuSub
        v-model:open="workflowSubmenuOpen"
        @update:open="onWorkflowSubmenuOpenChange"
      >
        <MenuSubTrigger>
          <i aria-hidden="true" class="icon-[comfy--workflow]" />
          <span class="flex-1 text-left whitespace-nowrap">
            {{ t('agent.workflows') }}
          </span>
          <i aria-hidden="true" class="icon-[lucide--chevron-right]" />
        </MenuSubTrigger>
        <MenuSubContent
          :side-offset="4"
          width="compact"
          max-height="compact"
          class="agent-scope"
        >
          <MenuItem @select.prevent="workflowSubmenuOpen = false">
            <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
            <span>{{ t('g.back') }}</span>
          </MenuItem>
          <MenuItem
            v-for="workflow in workflows"
            :key="workflow.id ?? workflow.tabPath"
            :disabled="workflowSelecting"
            @select.prevent="pickWorkflow(workflow)"
          >
            <i aria-hidden="true" class="icon-[comfy--workflow]" />
            <span class="max-w-64 truncate">{{ workflow.name }}</span>
            <span
              v-if="workflow.id === undefined"
              class="text-xs text-muted-foreground"
              >{{ t('agent.unsavedWorkflow') }}</span
            >
          </MenuItem>
          <div
            v-if="workflows.length === 0"
            class="px-2 py-1 text-xs text-muted-foreground"
          >
            {{ t('agent.noWorkflowsToReference') }}
          </div>
        </MenuSubContent>
      </MenuSub>
      <MenuSeparator v-if="canAttach" class="mt-0 mb-px" />
      <MenuItem v-if="canAttach" @select="emit('attach')">
        <i-lucide:paperclip class="size-4 shrink-0" />
        <span class="whitespace-nowrap">{{ t('agent.attachFiles') }}</span>
      </MenuItem>
    </MenuContent>
  </DropdownMenuRoot>
</template>
