<template>
  <div class="splitter-overlay-root flex flex-col">
    <slot name="workflow-tabs" />

    <div
      class="flex flex-1 pointer-events-none overflow-hidden"
      :class="{
        'flex-row': sidebarLocation === 'left',
        'flex-row-reverse': sidebarLocation === 'right'
      }"
    >
      <div
        class="side-toolbar-container pointer-events-auto"
        :class="{
          'sidebar-floating': !sidebarPanelVisible,
          'sidebar-connected': sidebarPanelVisible
        }"
      >
        <slot name="side-toolbar" />
      </div>

      <Splitter
        key="main-splitter-stable"
        class="flex-1 splitter-overlay overflow-hidden"
        :pt:gutter="sidebarPanelVisible ? '' : 'hidden'"
        :state-key="sidebarStateKey || 'main-splitter'"
        state-storage="local"
      >
        <SplitterPanel
          v-if="sidebarLocation === 'left'"
          class="side-bar-panel"
          :min-size="10"
          :size="20"
          :style="{
            display:
              sidebarPanelVisible && sidebarLocation === 'left'
                ? 'flex'
                : 'none'
          }"
        >
          <slot
            v-if="sidebarPanelVisible && sidebarLocation === 'left'"
            name="side-bar-panel"
          />
        </SplitterPanel>

        <SplitterPanel :size="80" class="flex flex-col">
          <slot name="topmenu" :sidebar-panel-visible="sidebarPanelVisible" />

          <Splitter
            class="splitter-overlay splitter-overlay-bottom flex-1 mb-2 mr-2"
            :class="{ 'ml-2': sidebarPanelVisible }"
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
          v-if="sidebarLocation === 'right'"
          class="side-bar-panel"
          :min-size="10"
          :size="20"
          :style="{
            display:
              sidebarPanelVisible && sidebarLocation === 'right'
                ? 'flex'
                : 'none'
          }"
        >
          <slot
            v-if="sidebarPanelVisible && sidebarLocation === 'right'"
            name="side-bar-panel"
          />
        </SplitterPanel>
      </Splitter>
    </div>
  </div>
</template>

<script setup lang="ts">
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
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
  if (unifiedWidth.value) {
    return 'unified-sidebar'
  }
  // When no tab is active, use a default key to maintain state
  return activeSidebarTabId.value ?? 'default-sidebar'
})
</script>

<style scoped>
@reference '../assets/css/style.css';

:deep(.p-splitter-gutter) {
  pointer-events: auto;
}

:deep(.p-splitter-gutter:hover),
:deep(.p-splitter-gutter[data-p-gutter-resizing='true']) {
  transition: background-color 0.2s ease 300ms;
  background-color: var(--p-primary-color);
}

.side-bar-panel {
  @apply pointer-events-auto;
  background-color: var(--bg-color);
}

.bottom-panel {
  @apply pointer-events-auto rounded-lg;
  background-color: var(--comfy-menu-bg);
  border: 1px solid var(--p-panel-border-color);
  max-width: 100%;
  overflow-x: auto;
}

.splitter-overlay-bottom :deep(.p-splitter-gutter) {
  @apply rounded-tl-lg rounded-tr-lg;
  transform: translateY(5px);
}

.splitter-overlay {
  @apply bg-transparent pointer-events-none border-none;
}

.splitter-overlay-root {
  @apply w-full h-full absolute top-0 left-0 pointer-events-none;

  /* Set it the same as the ComfyUI menu */
  /* Note: Lite-graph DOM widgets have the same z-index as the node id, so
  999 should be sufficient to make sure splitter overlays on node's DOM
  widgets */
  z-index: 999;
}
</style>
