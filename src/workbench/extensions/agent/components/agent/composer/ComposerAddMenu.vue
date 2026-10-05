<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import type { WorkflowReferenceOption } from '../../../types/workflowReference'

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
        v-tooltip.top="buildTooltipConfig(t('agent.addToPrompt'))"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('agent.addToPrompt')"
      >
        <span class="icon-[lucide--plus] size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="top"
        align="start"
        :side-offset="4"
        class="agent-scope z-1100 box-border w-max min-w-46.5 rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-lg"
      >
        <AccessibleTooltip
          :label="nodeReferenceDisabledReason ?? ''"
          :disabled="!nodeReferenceDisabledReason"
          :skip-delay-duration="0"
          disable-hoverable-content
          :collision-padding="8"
        >
          <template #trigger>
            <DropdownMenuItem
              :disabled="!!nodeReferenceDisabledReason"
              :aria-description="nodeReferenceDisabledReason"
              class="mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-highlighted:bg-secondary-background-hover"
              @select="emit('selectNodes', $event)"
            >
              <span class="icon-[comfy--node] size-4 shrink-0" />
              <span class="whitespace-nowrap">
                {{ t('agent.nodes') }}
              </span>
            </DropdownMenuItem>
          </template>
        </AccessibleTooltip>
        <DropdownMenuSub
          v-model:open="workflowSubmenuOpen"
          @update:open="onWorkflowSubmenuOpenChange"
        >
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
                @select.prevent="workflowSubmenuOpen = false"
              >
                <span class="icon-[lucide--chevron-left] size-4 shrink-0" />
                <span>{{ t('g.back') }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-for="workflow in workflows"
                :key="workflow.id ?? workflow.tabPath"
                :disabled="workflowSelecting"
                class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                @select.prevent="pickWorkflow(workflow)"
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
        <DropdownMenuItem
          v-if="canOpenAssets"
          class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
          @select="emit('openAssets')"
        >
          <span class="icon-[comfy--image-ai-edit] size-4 shrink-0" />
          <span class="whitespace-nowrap">
            {{ t('agent.addFromAssets') }}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator
          v-if="canAttach && canOpenAssets"
          class="mt-0 mb-px h-px bg-border-subtle"
        />
        <DropdownMenuItem
          v-if="canAttach"
          class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
          @select="emit('attach')"
        >
          <i-lucide:paperclip class="size-4 shrink-0" />
          <span class="whitespace-nowrap">{{ t('agent.attachFiles') }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
