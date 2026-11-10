<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const { workflowPath } = defineProps<{ workflowPath: string }>()
const { t } = useI18n()
const agentPanelStore = useAgentPanelStore()
</script>

<template>
  <Tooltip
    v-if="
      agentPanelStore.enabled &&
      agentPanelStore.selectedWorkflow?.path === workflowPath
    "
  >
    <TooltipTrigger as-child>
      <span
        role="img"
        :aria-label="t('agent.targetForThisChat')"
        class="inline-flex size-2.5 shrink-0 text-brand-yellow"
      >
        <i class="icon-[comfy--comfy-c] size-full" />
      </span>
    </TooltipTrigger>
    <TooltipContent side="right">{{
      t('agent.targetForThisChat')
    }}</TooltipContent>
  </Tooltip>
</template>
