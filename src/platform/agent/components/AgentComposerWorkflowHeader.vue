<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const emit = defineEmits<{
  dismiss: []
}>()

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()

const activeWorkflow = computed(() => workflowStore.activeWorkflow)
const otherWorkflows = computed(() =>
  workflowStore.openWorkflows.filter(
    (workflow) => workflow.key !== activeWorkflow.value?.key
  )
)

function switchWorkflow(workflow: (typeof otherWorkflows.value)[number]) {
  void workflowService.openWorkflow(workflow)
}
</script>

<template>
  <div
    v-if="activeWorkflow"
    class="-mb-2 flex h-7 w-full items-center gap-1 rounded-2xl border border-border-default bg-secondary-background px-3 text-xs"
  >
    <DropdownMenuRoot :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="flex min-w-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-muted-foreground hover:text-base-foreground"
          :aria-label="t('agent.workflowHeader.switchWorkflow')"
        >
          <i class="icon-[lucide--folder] size-3.5 shrink-0" />
          <span class="max-w-56 truncate">{{ activeWorkflow.filename }}</span>
          <span
            class="size-1.5 shrink-0 rounded-full bg-base-foreground"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="start"
          :side-offset="5"
          class="z-1000 min-w-48 rounded-lg border border-border-subtle bg-base-background p-1 shadow-interface"
        >
          <DropdownMenuItem
            v-for="workflow in otherWorkflows"
            :key="workflow.key"
            class="cursor-pointer truncate rounded-md px-2 py-1.5 text-xs outline-none hover:bg-secondary-background-hover"
            @select="switchWorkflow(workflow)"
          >
            {{ workflow.filename }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <Button
      size="icon-sm"
      variant="muted-textonly"
      class="size-4 shrink-0"
      :aria-label="t('agent.workflowHeader.dismiss')"
      @click="emit('dismiss')"
    >
      <i class="icon-[lucide--x] size-3" />
    </Button>
  </div>
</template>
