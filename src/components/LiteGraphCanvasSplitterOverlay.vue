<template>
  <div
    class="pointer-events-none absolute top-0 left-0 z-999 flex size-full flex-col"
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

      <SplitterGroup
        :key="splitterRefreshKey"
        direction="horizontal"
        :auto-save-id="splitterRefreshKey"
        class="pointer-events-none flex-1 overflow-hidden"
      >
        <!-- First panel: sidebar when left, properties when right -->
        <SplitterPanel
          v-if="
            !focusMode && (sidebarLocation === 'left' || showOffsideSplitter)
          "
          :order="1"
          :class="
            sidebarLocation === 'left'
              ? cn(
                  'side-bar-panel pointer-events-auto bg-comfy-menu-bg',
                  sidebarPanelVisible && 'min-w-78'
                )
              : 'pointer-events-auto bg-comfy-menu-bg'
          "
          :min-size="
            sidebarLocation === 'left' ? SIDEBAR_MIN_SIZE : BUILDER_MIN_SIZE
          "
          :default-size="SIDE_PANEL_SIZE"
          :style="firstPanelStyle"
          :role="sidebarLocation === 'left' ? 'complementary' : undefined"
          :aria-label="
            sidebarLocation === 'left' ? t('sideToolbar.sidebar') : undefined
          "
        >
          <slot
            v-if="sidebarLocation === 'left' && sidebarPanelVisible"
            name="side-bar-panel"
          />
          <slot
            v-else-if="sidebarLocation === 'right'"
            name="right-side-panel"
          />
        </SplitterPanel>
        <SplitterResizeHandle
          v-if="
            !focusMode && (sidebarLocation === 'left' || showOffsideSplitter)
          "
          :class="
            cn(
              'splitter-resize-handle pointer-events-auto w-1',
              sidebarLocation === 'left' && !sidebarPanelVisible && 'hidden'
            )
          "
        />

        <!-- Main panel (always present) -->
        <SplitterPanel
          :order="2"
          :default-size="CENTER_PANEL_SIZE"
          class="flex flex-col"
        >
          <slot name="topmenu" :sidebar-panel-visible />

          <SplitterGroup
            direction="vertical"
            auto-save-id="bottom-panel-splitter"
            class="splitter-overlay-bottom pointer-events-none mx-1 mb-1 flex-1"
          >
            <SplitterPanel :order="1" class="graph-canvas-panel relative">
              <slot name="graph-canvas-panel" />
            </SplitterPanel>
            <SplitterResizeHandle
              :class="
                cn(
                  'splitter-resize-handle pointer-events-auto w-1 translate-y-[5px] rounded-t-lg',
                  !(bottomPanelVisible && !focusMode) && 'hidden'
                )
              "
            />
            <SplitterPanel
              v-show="bottomPanelVisible && !focusMode"
              :order="2"
              class="bottom-panel pointer-events-auto max-w-full overflow-x-auto rounded-lg border border-(--p-panel-border-color) bg-comfy-menu-bg"
            >
              <slot name="bottom-panel" />
            </SplitterPanel>
          </SplitterGroup>
        </SplitterPanel>

        <!-- Last panel: properties when left, sidebar when right -->
        <SplitterResizeHandle
          v-if="
            !focusMode && (sidebarLocation === 'right' || showOffsideSplitter)
          "
          :class="
            cn(
              'splitter-resize-handle pointer-events-auto w-1',
              sidebarLocation === 'right' && !sidebarPanelVisible && 'hidden'
            )
          "
        />
        <SplitterPanel
          v-if="
            !focusMode && (sidebarLocation === 'right' || showOffsideSplitter)
          "
          :order="3"
          :class="
            sidebarLocation === 'right'
              ? cn(
                  'side-bar-panel pointer-events-auto bg-comfy-menu-bg',
                  sidebarPanelVisible && 'min-w-78'
                )
              : 'pointer-events-auto bg-comfy-menu-bg'
          "
          :min-size="
            sidebarLocation === 'right' ? SIDEBAR_MIN_SIZE : BUILDER_MIN_SIZE
          "
          :default-size="SIDE_PANEL_SIZE"
          :style="lastPanelStyle"
          :role="sidebarLocation === 'right' ? 'complementary' : undefined"
          :aria-label="
            sidebarLocation === 'right' ? t('sideToolbar.sidebar') : undefined
          "
        >
          <slot v-if="sidebarLocation === 'left'" name="right-side-panel" />
          <slot
            v-else-if="sidebarLocation === 'right' && sidebarPanelVisible"
            name="side-bar-panel"
          />
        </SplitterPanel>
      </SplitterGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppMode } from '@/composables/useAppMode'
import {
  BUILDER_MIN_SIZE,
  CENTER_PANEL_SIZE,
  SIDEBAR_MIN_SIZE,
  SIDE_PANEL_SIZE
} from '@/constants/splitterConstants'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const rightSidePanelStore = useRightSidePanelStore()
const sidebarTabStore = useSidebarTabStore()
const { t } = useI18n()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const { focusMode } = storeToRefs(workspaceStore)

const { isSelectMode, isBuilderMode } = useAppMode()
const { activeSidebarTab } = storeToRefs(sidebarTabStore)
const { bottomPanelVisible } = storeToRefs(useBottomPanelStore())
const { isOpen: rightSidePanelVisible } = storeToRefs(rightSidePanelStore)
const showOffsideSplitter = computed(
  () => rightSidePanelVisible.value || isSelectMode.value
)

const sidebarPanelVisible = computed(
  () => activeSidebarTab.value !== null && !isBuilderMode.value
)

/*
 * Force refresh the splitter when right panel visibility or sidebar location changes
 * to recalculate the width and panel order
 */
const splitterRefreshKey = computed(() => {
  return `main-splitter${rightSidePanelVisible.value ? '-with-right-panel' : ''}${isSelectMode.value ? '-builder' : ''}-${sidebarLocation.value}`
})

const firstPanelStyle = computed(() => {
  if (sidebarLocation.value === 'left') {
    return { display: sidebarPanelVisible.value ? 'flex' : 'none' }
  }
  return undefined
})

const lastPanelStyle = computed(() => {
  if (sidebarLocation.value === 'right') {
    return { display: sidebarPanelVisible.value ? 'flex' : 'none' }
  }
  return undefined
})
</script>

<style scoped>
.splitter-resize-handle[data-state='hover'],
.splitter-resize-handle[data-state='drag'] {
  transition: background-color 0.2s ease 300ms;
  background-color: var(--p-primary-color);
}
</style>
