<template>
  <div class="splitter-overlay-root pointer-events-none flex flex-col">
    <slot name="workflow-tabs" />

    <div
      class="pointer-events-none flex flex-1 overflow-hidden"
      :class="{
        'flex-row': sidebarLocation === 'left',
        'flex-row-reverse': sidebarLocation === 'right'
      }"
    >
      <div class="side-toolbar-container">
        <slot name="side-toolbar" />
      </div>

      <Splitter
        key="main-splitter-stable"
        class="splitter-overlay flex-1 overflow-hidden"
        :pt:gutter="sidebarPanelVisible ? '' : 'hidden'"
        :state-key="sidebarStateKey || 'main-splitter'"
        state-storage="local"
      >
        <SplitterPanel
          v-if="sidebarLocation === 'left'"
          class="side-bar-panel pointer-events-auto"
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
            class="splitter-overlay splitter-overlay-bottom mr-2 mb-2 ml-2 flex-1"
            layout="vertical"
            :pt:gutter="
              'rounded-tl-lg rounded-tr-lg ' +
              (bottomPanelVisible ? '' : 'hidden')
            "
            state-key="bottom-panel-splitter"
            state-storage="local"
          >
            <SplitterPanel class="graph-canvas-panel relative">
              <slot name="graph-canvas-panel" />
            </SplitterPanel>
            <SplitterPanel
              v-show="bottomPanelVisible"
              class="bottom-panel pointer-events-auto rounded-lg"
            >
              <slot name="bottom-panel" />
            </SplitterPanel>
          </Splitter>
        </SplitterPanel>

        <SplitterPanel
          v-if="sidebarLocation === 'right'"
          class="side-bar-panel pointer-events-auto"
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
  background-color: var(--bg-color);
}

.bottom-panel {
  background-color: var(--comfy-menu-bg);
  border: 1px solid var(--p-panel-border-color);
  max-width: 100%;
  overflow-x: auto;
}

.splitter-overlay-bottom :deep(.p-splitter-gutter) {
  transform: translateY(5px);
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
