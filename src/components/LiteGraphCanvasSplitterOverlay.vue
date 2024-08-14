<template>
  <Splitter class="splitter-overlay" :pt:gutter="gutterClass">
    <SplitterPanel
      class="side-bar-panel"
      :minSize="10"
      :size="20"
      v-show="sidebarPanelVisible"
      v-if="sidebarLocation === 'left'"
    >
      <slot name="side-bar-panel"></slot>
    </SplitterPanel>
    <SplitterPanel class="graph-canvas-panel" :size="100">
      <div></div>
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
import { useSettingStore } from '@/stores/settingStore'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

const settingStore = useSettingStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const sidebarPanelVisible = computed(
  () => useWorkspaceStore().activeSidebarTab !== null
)
const gutterClass = computed(() => {
  return sidebarPanelVisible.value ? '' : 'gutter-hidden'
})
</script>

<style>
.p-splitter-gutter {
  pointer-events: auto;
}

.gutter-hidden {
  display: none !important;
}
</style>

<style scoped>
.side-bar-panel {
  background-color: var(--bg-color);
  pointer-events: auto;
}

.splitter-overlay {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: transparent;
  pointer-events: none;
  /* Set it the same as the ComfyUI menu */
  /* Note: Lite-graph DOM widgets have the same z-index as the node id, so
  999 should be sufficient to make sure splitter overlays on node's DOM
  widgets */
  z-index: 999;
  border: none;
}
</style>
