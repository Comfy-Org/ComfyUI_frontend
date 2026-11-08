<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuSub from '@comfyorg/design-system/menu/MenuSub'
import MenuSubContent from '@comfyorg/design-system/menu/MenuSubContent'
import MenuSubTrigger from '@comfyorg/design-system/menu/MenuSubTrigger'
import type { WorkflowReferenceOption } from '@/workbench/extensions/agent/types/workflowReference'

const { workflows, selecting } = defineProps<{
  workflows: WorkflowReferenceOption[]
  selecting: boolean
}>()

const emit = defineEmits<{
  requestWorkflowReferences: []
  pick: [workflow: WorkflowReferenceOption]
}>()

const { t } = useI18n()
const open = ref(false)

function onOpenChange(next: boolean): void {
  if (next && !selecting) emit('requestWorkflowReferences')
}
</script>

<template>
  <MenuSub v-model:open="open" @update:open="onOpenChange">
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
      <MenuItem @select.prevent="open = false">
        <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
        <span>{{ t('g.back') }}</span>
      </MenuItem>
      <MenuItem
        v-for="workflow in workflows"
        :key="workflow.id ?? workflow.tabPath"
        :disabled="selecting"
        @select.prevent="emit('pick', workflow)"
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
</template>
