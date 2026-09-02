<template>
  <div
    v-if="docked"
    data-testid="docked-agent-panel"
    role="complementary"
    aria-labelledby="agent-panel-title"
    class="docked-agent-panel pointer-events-auto relative h-full shrink-0 overflow-hidden [anchor-name:--docked-agent-panel]"
    :style="{ width: `${width}px` }"
  >
    <div
      data-testid="agent-panel-resize-handle"
      class="agent-resize-handle absolute top-0 left-0 z-10 h-full w-[5px] cursor-col-resize"
      :data-resizing="isResizing"
      @pointerdown="onResizeStart"
      @lostpointercapture="isResizing = false"
    />
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

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, defineComponent, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkspaceInsetRight } from '@/composables/useWorkspaceInset'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const AgentPanelLoadError = defineComponent({
  name: 'AgentPanelLoadError',
  setup() {
    const { t } = useI18n()
    return () =>
      h('div', { class: 'size-full bg-base-background p-3' }, [
        h(
          'h2',
          { id: 'agent-panel-title', class: 'sr-only' },
          t('agent.title')
        ),
        h('p', { class: 'text-sm text-base-foreground' }, t('agent.loadFailed'))
      ])
  }
})

// Only a failed chunk load is a load failure; runtime errors inside the
// resolved panel keep their normal propagation.
const AgentPanelRoot = defineAsyncComponent({
  loader: () => import('@/workbench/extensions/agent/AgentPanelRoot.vue'),
  errorComponent: AgentPanelLoadError,
  onError: (error, _retry, fail) => {
    reportError(error, { errorType: 'agent_panel_load_failure' })
    fail()
  }
})

const agentPanelStore = useAgentPanelStore()
const { isOpen, enabled, width } = storeToRefs(agentPanelStore)
const docked = computed(() => enabled.value && isOpen.value)
useWorkspaceInsetRight(() => (docked.value ? width.value : 0))

const isResizing = ref(false)
let resizeStartX = 0
let resizeStartWidth = 0

function onResizeStart(e: PointerEvent): void {
  isResizing.value = true
  resizeStartX = e.clientX
  resizeStartWidth = agentPanelStore.width
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

useEventListener(document, 'pointermove', (e: PointerEvent) => {
  if (!isResizing.value) return
  agentPanelStore.setWidth(resizeStartWidth + (resizeStartX - e.clientX))
})
</script>

<style scoped>
.agent-resize-handle:hover,
.agent-resize-handle[data-resizing='true'] {
  transition: background-color 0.2s ease 300ms;
  background-color: var(--p-primary-color);
}
</style>
