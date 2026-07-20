<template>
  <div
    v-if="docked"
    data-testid="docked-agent-panel"
    class="docked-agent-panel pointer-events-auto relative h-full shrink-0 overflow-hidden"
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
      class="size-full border-l border-interface-stroke bg-comfy-menu-bg p-2"
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
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const agentPanelStore = useAgentPanelStore()
const { isOpen, enabled, width } = storeToRefs(agentPanelStore)
const docked = computed(() => enabled.value && isOpen.value)

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
