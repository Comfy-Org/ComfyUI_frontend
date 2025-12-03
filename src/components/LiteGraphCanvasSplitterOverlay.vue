<template>
  <div
    class="w-full h-full absolute top-0 left-0 z-999 pointer-events-none flex flex-col"
  >
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
        :key="splitterRefreshKey"
        class="bg-transparent pointer-events-none border-none flex-1 overflow-hidden"
        :state-key="sidebarStateKey"
        state-storage="local"
        @resizestart="onResizestart"
      >
        <SplitterPanel
          v-if="sidebarLocation === 'left'"
          class="side-bar-panel bg-comfy-menu-bg pointer-events-auto"
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
            class="bg-transparent pointer-events-none border-none splitter-overlay-bottom mr-1 mb-1 ml-1 flex-1"
            layout="vertical"
            :pt:gutter="
              'rounded-tl-lg rounded-tr-lg ' +
              (bottomPanelVisible ? '' : 'hidden')
            "
            state-key="bottom-panel-splitter"
            state-storage="local"
            @resizestart="onResizestart"
          >
            <SplitterPanel class="graph-canvas-panel relative">
              <slot name="graph-canvas-panel" />
            </SplitterPanel>
            <SplitterPanel
              v-show="bottomPanelVisible"
              class="bottom-panel border border-(--p-panel-border-color) max-w-full overflow-x-auto bg-comfy-menu-bg pointer-events-auto rounded-lg"
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

        <!-- Right Side Panel - independent of sidebar -->
        <SplitterPanel
          v-if="rightSidePanelVisible"
          class="bg-comfy-menu-bg pointer-events-auto"
          :min-size="15"
          :size="20"
        >
          <slot name="right-side-panel" />
        </SplitterPanel>
      </Splitter>
    </div>
  </div>
</template>

<script setup lang="ts">
import Splitter from 'primevue/splitter'
import type { SplitterResizeStartEvent } from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const settingStore = useSettingStore()
const rightSidePanelStore = useRightSidePanelStore()
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
const rightSidePanelVisible = computed(() => rightSidePanelStore.isOpen)
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

/**
 * Force refresh the splitter when right panel visibility changes to recalculate the width
 */
const splitterRefreshKey = computed(() => {
  return rightSidePanelVisible.value
    ? 'main-splitter-with-right-panel'
    : 'main-splitter'
})

/**
 * Avoid triggering default behaviors during drag-and-drop, such as text selection.
 */
function onResizestart({ originalEvent: event }: SplitterResizeStartEvent) {
  event.preventDefault()
}
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

/* Hide sidebar gutter when sidebar is not visible */
:deep(.side-bar-panel[style*='display: none'] + .p-splitter-gutter),
:deep(.p-splitter-gutter + .side-bar-panel[style*='display: none']) {
  display: none;
}

.splitter-overlay-bottom :deep(.p-splitter-gutter) {
  transform: translateY(5px);
}
</style>
