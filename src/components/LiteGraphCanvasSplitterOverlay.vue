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
        <!-- Properties Panel on left when sidebar is on right -->
        <SplitterPanel
          v-if="
            rightSidePanelVisible && !focusMode && sidebarLocation === 'right'
          "
          class="bg-comfy-menu-bg pointer-events-auto"
          :min-size="15"
          :size="20"
        >
          <slot name="right-side-panel" />
        </SplitterPanel>

        <SplitterPanel
          v-if="sidebarLocation === 'left' && !focusMode"
          :class="
            cn(
              'side-bar-panel bg-comfy-menu-bg pointer-events-auto',
              sidebarPanelVisible && 'min-w-78'
            )
          "
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
          <slot name="topmenu" :sidebar-panel-visible />

          <Splitter
            class="bg-transparent pointer-events-none border-none splitter-overlay-bottom mr-1 mb-1 ml-1 flex-1"
            layout="vertical"
            :pt:gutter="
              cn(
                'rounded-tl-lg rounded-tr-lg ',
                !(bottomPanelVisible && !focusMode) && 'hidden'
              )
            "
            state-key="bottom-panel-splitter"
            state-storage="local"
            @resizestart="onResizestart"
          >
            <SplitterPanel class="graph-canvas-panel relative">
              <slot name="graph-canvas-panel" />
            </SplitterPanel>
            <SplitterPanel
              v-show="bottomPanelVisible && !focusMode"
              class="bottom-panel border border-(--p-panel-border-color) max-w-full overflow-x-auto bg-comfy-menu-bg pointer-events-auto rounded-lg"
            >
              <slot name="bottom-panel" />
            </SplitterPanel>
          </Splitter>
        </SplitterPanel>

        <SplitterPanel
          v-if="sidebarLocation === 'right' && !focusMode"
          :class="
            cn(
              'side-bar-panel pointer-events-auto',
              sidebarPanelVisible && 'min-w-78'
            )
          "
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

        <!-- Properties Panel on right when sidebar is on left (default) -->
        <SplitterPanel
          v-if="
            rightSidePanelVisible && !focusMode && sidebarLocation === 'left'
          "
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
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import Splitter from 'primevue/splitter'
import type { SplitterResizeStartEvent } from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const rightSidePanelStore = useRightSidePanelStore()
const sidebarTabStore = useSidebarTabStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const unifiedWidth = computed(() =>
  settingStore.get('Comfy.Sidebar.UnifiedWidth')
)

const { focusMode } = storeToRefs(workspaceStore)

const { activeSidebarTabId, activeSidebarTab } = storeToRefs(sidebarTabStore)
const { bottomPanelVisible } = storeToRefs(useBottomPanelStore())
const { isOpen: rightSidePanelVisible } = storeToRefs(rightSidePanelStore)

const sidebarPanelVisible = computed(() => activeSidebarTab.value !== null)

const sidebarStateKey = computed(() => {
  return unifiedWidth.value
    ? 'unified-sidebar'
    : // When no tab is active, use a default key to maintain state
      (activeSidebarTabId.value ?? 'default-sidebar')
})

/**
 * Avoid triggering default behaviors during drag-and-drop, such as text selection.
 */
function onResizestart({ originalEvent: event }: SplitterResizeStartEvent) {
  event.preventDefault()
}

/*
 * Force refresh the splitter when right panel visibility or sidebar location changes
 * to recalculate the width and panel order
 */
const splitterRefreshKey = computed(() => {
  const parts = ['main-splitter']
  if (rightSidePanelVisible.value) {
    parts.push('with-right-panel')
  }
  parts.push(sidebarLocation.value)
  return parts.join('-')
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

/* Hide sidebar gutter when sidebar is not visible */
:deep(.side-bar-panel[style*='display: none'] + .p-splitter-gutter),
:deep(.p-splitter-gutter + .side-bar-panel[style*='display: none']) {
  display: none;
}

.splitter-overlay-bottom :deep(.p-splitter-gutter) {
  transform: translateY(5px);
}
</style>
