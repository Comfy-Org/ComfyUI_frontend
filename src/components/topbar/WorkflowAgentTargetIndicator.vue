<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const { workflowPath } = defineProps<{ workflowPath: string }>()
const { t } = useI18n()
const agentPanelStore = useAgentPanelStore()
</script>

<template>
  <span
    v-if="
      agentPanelStore.enabled &&
      agentPanelStore.selectedWorkflow?.path === workflowPath
    "
    v-tooltip="{ value: t('agent.targetForThisChat'), showDelay: 300 }"
    role="img"
    :aria-label="t('agent.targetForThisChat')"
    class="inline-flex size-3.5 shrink-0 text-brand-yellow"
  >
    <i class="icon-[comfy--comfy-c] size-full" />
  </span>
</template>
