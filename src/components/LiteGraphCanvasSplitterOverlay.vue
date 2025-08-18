<template>
  <Splitter
    :key="sidebarStateKey"
    class="splitter-overlay-root splitter-overlay"
    :pt:gutter="sidebarPanelVisible ? '' : 'hidden'"
    :state-key="sidebarStateKey"
    state-storage="local"
  >
    <SplitterPanel
      v-show="sidebarPanelVisible"
      v-if="sidebarLocation === 'left'"
      class="side-bar-panel"
      :min-size="10"
      :size="20"
    >
      <slot name="side-bar-panel" />
    </SplitterPanel>

    <SplitterPanel :size="100">
      <Splitter
        class="splitter-overlay max-w-full"
        layout="vertical"
        :pt:gutter="bottomPanelVisible ? '' : 'hidden'"
        state-key="bottom-panel-splitter"
        state-storage="local"
      >
        <SplitterPanel class="graph-canvas-panel relative">
          <slot name="graph-canvas-panel" />
        </SplitterPanel>
        <SplitterPanel v-show="bottomPanelVisible" class="bottom-panel">
          <slot name="bottom-panel" />
        </SplitterPanel>
      </Splitter>
    </SplitterPanel>

    <SplitterPanel
      v-show="sidebarPanelVisible"
      v-if="sidebarLocation === 'right'"
      class="side-bar-panel"
      :min-size="10"
      :size="20"
    >
      <slot name="side-bar-panel" />
    </SplitterPanel>
  </Splitter>
</template>

<script setup lang="ts">
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import { useSettingStore } from '@/stores/settingStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const settingStore = useSettingStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const unifiedWidth = computed(() =>
  settingStore.get('Comfy.Sidebar.UnifiedWidth')
)

const sidebarPanelVisible = computed(
  () => useSidebarTabStore().activeSidebarTab !== null
)
const bottomPanelVisible = computed(
  () => useBottomPanelStore().bottomPanelVisible
)
const activeSidebarTabId = computed(
  () => useSidebarTabStore().activeSidebarTabId
)

const sidebarStateKey = computed(() => {
  return unifiedWidth.value ? 'unified-sidebar' : activeSidebarTabId.value ?? ''
})
</script>

<style scoped>
:deep(.p-splitter-gutter) {
  pointer-events: auto;
}

:deep(.p-splitter-gutter:hover),
:deep(.p-splitter-gutter[data-p-gutter-resizing='true']) {
  transition: background-color 0.2s ease 300ms;
  background-color: var(--p-primary-color);
}

.side-bar-panel {
  background-color: var(--bg-color);
  pointer-events: auto;
}

.bottom-panel {
  background-color: var(--bg-color);
  pointer-events: auto;
}

.splitter-overlay {
  @apply bg-transparent pointer-events-none border-none;
}

.splitter-overlay-root {
  @apply w-full h-full absolute top-0 left-0;

  /* Set it the same as the ComfyUI menu */
  /* Note: Lite-graph DOM widgets have the same z-index as the node id, so
  999 should be sufficient to make sure splitter overlays on node's DOM
  widgets */
  z-index: 999;
}
</style>
