<script setup lang="ts">
import { DropdownMenuPortal, DropdownMenuSub } from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuItem from '@/components/ui/menu/MenuItem.vue'
import MenuSeparator from '@/components/ui/menu/MenuSeparator.vue'
import MenuSubContent from '@/components/ui/menu/MenuSubContent.vue'
import MenuSubTrigger from '@/components/ui/menu/MenuSubTrigger.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
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
  <Menu
    v-model:open="addMenuOpen"
    side="top"
    :side-offset="4"
    width="compact"
    class="agent-scope"
  >
    <template #trigger>
      <Button
        :tooltip="t('agent.addToPrompt')"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('agent.addToPrompt')"
      >
        <span class="icon-[lucide--plus] size-4" />
      </Button>
    </template>
    <Tooltip :disabled="!nodeReferenceDisabledReason">
      <TooltipTrigger as-child>
        <MenuItem
          :disabled="!!nodeReferenceDisabledReason"
          :aria-description="nodeReferenceDisabledReason"
          @select="emit('selectNodes', $event)"
        >
          <span class="icon-[comfy--node] size-4 shrink-0" />
          <span class="whitespace-nowrap">
            {{ t('agent.nodes') }}
          </span>
        </MenuItem>
      </TooltipTrigger>
      <TooltipContent>{{ nodeReferenceDisabledReason }}</TooltipContent>
    </Tooltip>
    <DropdownMenuSub
      v-model:open="workflowSubmenuOpen"
      @update:open="onWorkflowSubmenuOpenChange"
    >
      <MenuSubTrigger>
        <span class="icon-[comfy--workflow] size-4 shrink-0" />
        <span class="flex-1 text-left whitespace-nowrap">
          {{ t('agent.workflows') }}
        </span>
        <span class="icon-[lucide--chevron-right] size-4 shrink-0" />
      </MenuSubTrigger>
      <DropdownMenuPortal :key="Number(workflowSubmenuOpen)">
        <MenuSubContent
          :side-offset="4"
          width="compact"
          max-height="compact"
          class="agent-scope"
        >
          <MenuItem @select.prevent="workflowSubmenuOpen = false">
            <span class="icon-[lucide--chevron-left] size-4 shrink-0" />
            <span>{{ t('g.back') }}</span>
          </MenuItem>
          <MenuItem
            v-for="workflow in workflows"
            :key="workflow.id ?? workflow.tabPath"
            :disabled="workflowSelecting"
            @select.prevent="pickWorkflow(workflow)"
          >
            <span class="icon-[comfy--workflow] size-4 shrink-0" />
            <span class="max-w-64 truncate">{{ workflow.name }}</span>
            <span
              v-if="workflow.id === undefined"
              class="text-xs text-muted-foreground"
              >{{ t('agent.unsavedWorkflow') }}</span
            >
          </MenuItem>
          <div
            v-if="workflows.length === 0"
            class="px-3 py-1.5 text-xs text-muted-foreground"
          >
            {{ t('agent.noWorkflowsToReference') }}
          </div>
        </MenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <MenuItem v-if="canOpenAssets" @select="emit('openAssets')">
      <span class="icon-[comfy--image-ai-edit] size-4 shrink-0" />
      <span class="whitespace-nowrap">
        {{ t('agent.addFromAssets') }}
      </span>
    </MenuItem>
    <MenuSeparator v-if="canAttach && canOpenAssets" />
    <MenuItem v-if="canAttach" @select="emit('attach')">
      <i-lucide:paperclip class="size-4 shrink-0" />
      <span class="whitespace-nowrap">{{ t('agent.attachFiles') }}</span>
    </MenuItem>
  </Menu>
</template>
