<template>
  <div
    v-if="docked"
    data-testid="docked-agent-panel"
    role="complementary"
    :aria-label="t('agent.title')"
    class="docked-agent-panel pointer-events-auto relative h-full shrink-0 overflow-hidden"
    :style="{ width: `${PANEL_WIDTH}px` }"
  >
    <div
      class="bg-agent-surface size-full border-l border-interface-stroke p-2"
    >
      <div
        class="size-full overflow-hidden rounded-lg border border-interface-stroke"
      >
        <AgentPanelRoot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const AgentPanelRoot = defineAsyncComponent(
  () => import('@/workbench/extensions/agent/AgentPanelRoot.vue')
)

const PANEL_WIDTH = 420

const { t } = useI18n()
const agentPanelStore = useAgentPanelStore()
const { isOpen, enabled } = storeToRefs(agentPanelStore)
const docked = computed(() => enabled.value && isOpen.value)
</script>
