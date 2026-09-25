<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
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
    :config="{ value: t('agent.targetForThisChat'), showDelay: 300 }"
  >
    <span
      role="img"
      :aria-label="t('agent.targetForThisChat')"
      class="inline-flex size-2.5 shrink-0 text-brand-yellow"
    >
      <i class="icon-[comfy--comfy-c] size-full" />
    </span>
  </Tooltip>
</template>
