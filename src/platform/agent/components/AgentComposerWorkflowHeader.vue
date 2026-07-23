<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxViewport
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { selectContentClass } from '@/components/ui/select/select.variants'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()

const isOpen = ref(false)
const searchQuery = ref('')
const isDismissed = ref(false)

const activeWorkflow = computed(() => workflowStore.activeWorkflow)
// A dismissal only hides the workflow's name for the workflow that was
// active when dismissed - switching workflows brings the label back.
watch(
  () => activeWorkflow.value?.key,
  () => {
    isDismissed.value = false
  }
)

const triggerWorkflow = computed(() =>
  isDismissed.value ? null : activeWorkflow.value
)
const triggerLabel = computed(
  () =>
    triggerWorkflow.value?.filename ?? t('agent.workflowHeader.chooseWorkflow')
)
const filteredWorkflows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const workflows = workflowStore.openWorkflows
  return query
    ? workflows.filter((workflow) =>
        workflow.filename.toLowerCase().includes(query)
      )
    : workflows
})

function switchWorkflow(workflow: ComfyWorkflow) {
  void workflowService.openWorkflow(workflow)
  isOpen.value = false
  searchQuery.value = ''
}
</script>

<template>
  <ComboboxRoot v-model:open="isOpen" ignore-filter>
    <ComboboxAnchor as-child>
      <div
        class="-mb-5 flex w-full items-center justify-between gap-1 rounded-t-2xl border border-border-default bg-base-background px-3 pt-3 pb-7 text-xs"
      >
        <Button
          type="button"
          variant="muted-textonly"
          size="unset"
          class="min-w-0 gap-2 rounded-md px-1.5 py-1 text-xs font-normal text-base-foreground"
          :aria-label="t('agent.workflowHeader.switchWorkflow')"
          aria-haspopup="listbox"
          :aria-expanded="isOpen"
          @click="isOpen = !isOpen"
        >
          <i
            class="icon-[comfy--workflow] size-3 shrink-0 text-muted-foreground"
          />
          <span class="min-w-0 truncate text-left">
            {{ triggerLabel }}
          </span>
          <span
            v-if="triggerWorkflow"
            class="size-1.5 shrink-0 rounded-full bg-base-foreground"
            aria-hidden="true"
          />
        </Button>

        <Button
          type="button"
          size="icon-sm"
          variant="muted-textonly"
          class="size-4 shrink-0"
          :aria-label="t('agent.workflowHeader.dismiss')"
          @click="isDismissed = true"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        side="top"
        :side-offset="4"
        align="start"
        :class="
          cn(
            selectContentClass,
            'w-(--reka-combobox-trigger-width) p-0 data-[side=top]:slide-in-from-bottom-2'
          )
        "
      >
        <div
          class="flex items-center gap-2 border-b border-border-default px-3 py-2"
        >
          <i
            class="icon-[lucide--search] shrink-0 text-sm text-muted-foreground"
          />
          <ComboboxInput
            v-model="searchQuery"
            :placeholder="
              t('g.searchPlaceholder', { subject: t('g.workflows') })
            "
            class="w-full border-none bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ComboboxViewport
          class="flex scrollbar-custom max-h-64 flex-col gap-0.5 overflow-y-auto p-1"
        >
          <ComboboxItem
            v-for="workflow in filteredWorkflows"
            :key="workflow.key"
            :value="workflow"
            class="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
            @select="switchWorkflow(workflow)"
          >
            <i
              class="icon-[comfy--workflow] size-3.5 shrink-0 text-muted-foreground"
            />
            <span class="min-w-0 flex-1 truncate">{{ workflow.filename }}</span>
            <span
              v-if="workflow.isModified"
              class="size-1.5 shrink-0 rounded-full bg-base-foreground"
              aria-hidden="true"
            />
            <i
              v-if="workflow.key === activeWorkflow?.key"
              class="icon-[lucide--check] size-3.5 shrink-0"
              aria-hidden="true"
            />
          </ComboboxItem>
          <ComboboxEmpty
            class="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            {{ t('g.noResultsFound') }}
          </ComboboxEmpty>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
