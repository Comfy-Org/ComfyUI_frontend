<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        v-tooltip="{ value: $t('g.moreWorkflows'), showDelay: 300 }"
        class="aspect-square h-full w-auto rounded-none"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.moreWorkflows')"
      >
        <i class="icon-[lucide--ellipsis]" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      size="lg"
      align="end"
      :side-offset="4"
      class="max-h-[40vh] overflow-auto"
    >
      <DropdownMenuItem
        v-for="workflow in workflows"
        :key="workflow.key"
        checkable
        :checked="activeWorkflow?.key === workflow.key"
        @select="() => workflowService.openWorkflow(workflow)"
      >
        {{ workflow.filename }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

defineProps<{
  workflows: ComfyWorkflow[]
  activeWorkflow: ComfyWorkflow | null
}>()

const workflowService = useWorkflowService()
</script>
