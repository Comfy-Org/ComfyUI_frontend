<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { WorkflowReferenceOption } from '../../../types/workflowReference'

const { workflows, selecting } = defineProps<{
  workflows: WorkflowReferenceOption[]
  selecting: boolean
}>()
const emit = defineEmits<{
  request: []
  pick: [workflow: WorkflowReferenceOption]
}>()
const { t } = useI18n()
const open = ref(false)

function onOpenChange(value: boolean): void {
  if (value && !selecting) emit('request')
}
</script>

<template>
  <DropdownMenuSub v-model:open="open" @update:open="onOpenChange">
    <DropdownMenuSubTrigger
      class="mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
    >
      <span class="icon-[comfy--workflow] size-4 shrink-0" />
      <span class="flex-1 text-left whitespace-nowrap">
        {{ t('agent.workflows') }}
      </span>
      <span class="icon-[lucide--chevron-right] size-4 shrink-0" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent
        :side-offset="4"
        class="agent-scope z-1100 box-border max-h-64 min-w-46.5 overflow-y-auto rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-lg"
      >
        <DropdownMenuItem
          class="mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
          @select.prevent="open = false"
        >
          <span class="icon-[lucide--chevron-left] size-4 shrink-0" />
          <span>{{ t('g.back') }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="workflow in workflows"
          :key="workflow.id ?? workflow.tabPath"
          :disabled="selecting"
          class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
          @select.prevent="emit('pick', workflow)"
        >
          <span class="icon-[comfy--workflow] size-4 shrink-0" />
          <span class="max-w-64 truncate">{{ workflow.name }}</span>
          <span
            v-if="workflow.id === undefined"
            class="text-xs text-muted-foreground"
            >{{ t('agent.unsavedWorkflow') }}</span
          >
        </DropdownMenuItem>
        <div
          v-if="workflows.length === 0"
          class="px-2 py-1 text-xs text-muted-foreground"
        >
          {{ t('agent.noWorkflowsToReference') }}
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>
