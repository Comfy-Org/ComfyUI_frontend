<template>
  <div
    v-if="docked"
    data-testid="docked-agent-panel"
    class="docked-agent-panel pointer-events-auto relative h-full shrink-0 overflow-hidden"
    :style="{ width: `${width}px` }"
  >
    <div
      data-testid="docked-agent-panel-shell"
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

<script lang="ts">
import { defineAsyncComponent } from 'vue'

const AgentPanelRoot = defineAsyncComponent(
  () => import('@/workbench/extensions/agent/AgentPanelRoot.vue')
)
</script>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const agentPanelStore = useAgentPanelStore()
const { isOpen, enabled, width } = storeToRefs(agentPanelStore)
const docked = computed(() => enabled.value && isOpen.value)
</script>
