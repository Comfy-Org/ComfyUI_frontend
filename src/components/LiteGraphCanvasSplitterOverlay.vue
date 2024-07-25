<template>
  <Splitter class="splitter-overlay" :pt:gutter="gutterClass">
    <SplitterPanel
      class="side-bar-panel"
      :minSize="10"
      :size="20"
      v-show="sideBarPanelVisible"
    >
      <slot name="side-bar-panel"></slot>
    </SplitterPanel>
    <SplitterPanel class="graph-canvas-panel" :size="100">
      <div></div>
    </SplitterPanel>
  </Splitter>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

const sideBarPanelVisible = computed(
  () => useWorkspaceStore().activeSidebarTab !== null
)
const gutterClass = computed(() => {
  return sideBarPanelVisible.value ? '' : 'gutter-hidden'
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
  z-index: 10;
  border: none;
}
</style>
