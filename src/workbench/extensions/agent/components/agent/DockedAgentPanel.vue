<template>
  <div
    v-if="docked"
    data-testid="docked-agent-panel"
    role="complementary"
    aria-labelledby="agent-panel-title"
    class="pointer-events-auto relative h-full w-[min(420px,33%)] shrink-0 overflow-hidden"
  >
    <div
      class="size-full border-l border-interface-stroke bg-base-background p-2"
    >
      <div
        class="size-full overflow-hidden rounded-lg border border-interface-stroke"
      >
        <Suspense>
          <AgentPanelRoot />
          <template #fallback>
            <div class="size-full bg-base-background" />
          </template>
        </Suspense>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'

const AgentPanelRoot = defineAsyncComponent(
  () =>
    import('@/workbench/extensions/agent/components/agent/AgentPanelRoot.vue')
)

const agentPanelStore = useAgentPanelStore()
const { isOpen, enabled } = storeToRefs(agentPanelStore)
const docked = computed(() => enabled.value && isOpen.value)
</script>
