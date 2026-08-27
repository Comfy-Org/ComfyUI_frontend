<template>
  <div
    v-if="docked"
    data-testid="docked-agent-panel"
    role="complementary"
    aria-labelledby="agent-panel-title"
    class="pointer-events-auto relative h-full w-1/3 max-w-[420px] shrink-0 overflow-hidden"
  >
    <div
      class="size-full border-l border-interface-stroke bg-base-background p-2"
    >
      <div
        class="size-full overflow-hidden rounded-lg border border-interface-stroke"
      >
        <div v-if="loadFailed" class="size-full bg-base-background p-3">
          <h2 id="agent-panel-title" class="sr-only">
            {{ t('agent.title') }}
          </h2>
          <p class="text-sm text-base-foreground">
            {{ t('agent.loadFailed') }}
          </p>
        </div>
        <Suspense v-else>
          <AgentPanelRoot />
          <template #fallback>
            <div class="size-full bg-base-background">
              <h2 id="agent-panel-title" class="sr-only">
                {{ t('agent.title') }}
              </h2>
            </div>
          </template>
        </Suspense>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { reportError } from '@/platform/telemetry/reportError'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'

const loadFailed = ref(false)
// Only a failed chunk load is a load failure; runtime errors inside the
// resolved panel keep their normal propagation.
const AgentPanelRoot = defineAsyncComponent(() =>
  import('@/workbench/extensions/agent/components/agent/AgentPanelRoot.vue').catch(
    (error: unknown) => {
      reportError(error, { errorType: 'agent_panel_load_failure' })
      loadFailed.value = true
      throw error
    }
  )
)

const { t } = useI18n()
const agentPanelStore = useAgentPanelStore()
const { isOpen, enabled } = storeToRefs(agentPanelStore)
const docked = computed(() => enabled.value && isOpen.value)
</script>
