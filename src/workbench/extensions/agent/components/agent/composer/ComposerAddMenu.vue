<script setup lang="ts">
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@comfyorg/design-system/button/Button'
import MenuContent from '@comfyorg/design-system/menu/MenuContent'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import type { WorkflowReferenceOption } from '@/workbench/extensions/agent/types/workflowReference'

import ComposerWorkflowSubmenu from './ComposerWorkflowSubmenu.vue'

type AddMenuEntry = 'nodes' | 'workflows' | 'assets' | 'separator' | 'upload'

const {
  canAttach,
  canOpenAssets,
  nodeReferenceDisabledReason,
  workflows,
  workflowSelecting,
  selectWorkflow,
  layout = 'classic'
} = defineProps<{
  canAttach: boolean
  canOpenAssets: boolean
  nodeReferenceDisabledReason?: string
  workflows: WorkflowReferenceOption[]
  workflowSelecting: boolean
  selectWorkflow: (workflow: WorkflowReferenceOption) => Promise<boolean>
  layout?: 'classic' | 'redesign'
}>()
const emit = defineEmits<{
  selectNodes: [event: Event]
  attach: []
  openAssets: []
  requestWorkflowReferences: []
}>()
const { t } = useI18n()
const addMenuOpen = ref(false)
async function pickWorkflow(workflow: WorkflowReferenceOption): Promise<void> {
  if (await selectWorkflow(workflow)) addMenuOpen.value = false
}

const assetsLabel = computed(() =>
  layout === 'redesign' ? t('agent.outputs.addFrom') : t('agent.addFromAssets')
)

const entries = computed(() => {
  const order: [entry: AddMenuEntry, shown: boolean][] =
    layout === 'redesign'
      ? [
          ['upload', canAttach],
          ['assets', canOpenAssets],
          ['separator', canAttach || canOpenAssets],
          ['workflows', true],
          ['nodes', true]
        ]
      : [
          ['assets', canOpenAssets],
          ['nodes', true],
          ['workflows', true],
          ['separator', canAttach],
          ['upload', canAttach]
        ]
  return order.filter(([, shown]) => shown).map(([entry]) => entry)
})
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
      <template v-for="entry in entries" :key="entry">
        <MenuItem
          v-if="entry === 'assets'"
          class="mb-0.5"
          @select="emit('openAssets')"
        >
          <i aria-hidden="true" class="icon-[comfy--image-ai-edit]" />
          <span class="whitespace-nowrap">{{ assetsLabel }}</span>
        </MenuItem>
        <Tooltip
          v-else-if="entry === 'nodes'"
          :disabled="!nodeReferenceDisabledReason"
        >
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
        <ComposerWorkflowSubmenu
          v-else-if="entry === 'workflows'"
          :workflows
          :selecting="workflowSelecting"
          @request-workflow-references="emit('requestWorkflowReferences')"
          @pick="pickWorkflow"
        />
        <MenuSeparator v-else-if="entry === 'separator'" class="mt-0 mb-px" />
        <MenuItem v-else-if="entry === 'upload'" @select="emit('attach')">
          <i aria-hidden="true" class="icon-[lucide--paperclip]" />
          <span class="whitespace-nowrap">{{ t('agent.attachFiles') }}</span>
        </MenuItem>
      </template>
    </MenuContent>
  </DropdownMenuRoot>
</template>
