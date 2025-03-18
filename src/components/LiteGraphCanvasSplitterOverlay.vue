<template>
  <Splitter
    class="splitter-overlay-root splitter-overlay"
    :pt:gutter="sidebarPanelVisible ? '' : 'hidden'"
    :key="activeSidebarTabId ?? undefined"
    :stateKey="activeSidebarTabId ?? undefined"
    stateStorage="local"
  >
    <SplitterPanel
      class="side-bar-panel"
      :minSize="10"
      :size="20"
      v-show="sidebarPanelVisible"
      v-if="sidebarLocation === 'left'"
    >
      <slot name="side-bar-panel"></slot>
    </SplitterPanel>

    <SplitterPanel :size="100">
      <Splitter
        class="splitter-overlay max-w-full"
        layout="vertical"
        :pt:gutter="bottomPanelVisible ? '' : 'hidden'"
        stateKey="bottom-panel-splitter"
        stateStorage="local"
      >
        <SplitterPanel class="graph-canvas-panel relative">
          <slot name="graph-canvas-panel"></slot>
        </SplitterPanel>
        <SplitterPanel class="bottom-panel" v-show="bottomPanelVisible">
          <slot name="bottom-panel"></slot>
        </SplitterPanel>
      </Splitter>
    </SplitterPanel>

    <SplitterPanel
      class="side-bar-panel"
      :minSize="10"
      :size="20"
      v-show="sidebarPanelVisible"
      v-if="sidebarLocation === 'right'"
    >
      <slot name="side-bar-panel"></slot>
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

const sidebarPanelVisible = computed(
  () => useSidebarTabStore().activeSidebarTab !== null
)
const bottomPanelVisible = computed(
  () => useBottomPanelStore().bottomPanelVisible
)
const activeSidebarTabId = computed(
  () => useSidebarTabStore().activeSidebarTabId
)
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
