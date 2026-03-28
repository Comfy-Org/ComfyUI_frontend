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

      <Splitter
        :key="splitterRefreshKey"
        class="pointer-events-none flex-1 overflow-hidden border-none bg-transparent"
        :state-key="
          isSelectMode
            ? sidebarLocation === 'left'
              ? 'builder-splitter'
              : 'builder-splitter-right'
            : sidebarStateKey
        "
        state-storage="local"
        @resizestart="onResizestart"
        @resizeend="normalizeSavedSizes"
      >
        <!-- First panel: sidebar when left, properties when right -->
        <SplitterPanel
          v-if="firstPanelVisible"
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
          :size="SIDE_PANEL_SIZE"
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

        <!-- Main panel (always present) -->
        <SplitterPanel :size="centerPanelDefaultSize" class="flex flex-col">
          <slot name="topmenu" :sidebar-panel-visible />

          <Splitter
            class="splitter-overlay-bottom pointer-events-none mx-1 mb-1 flex-1 border-none bg-transparent"
            layout="vertical"
            :pt:gutter="
              cn(
                'rounded-t-lg',
                !(bottomPanelVisible && !focusMode) && 'hidden'
              )
            "
            state-key="bottom-panel-splitter"
            state-storage="local"
            @resizestart="onResizestart"
          >
            <SplitterPanel class="graph-canvas-panel relative overflow-visible">
              <slot name="graph-canvas-panel" />
            </SplitterPanel>
            <SplitterPanel
              v-show="bottomPanelVisible && !focusMode"
              class="bottom-panel pointer-events-auto max-w-full overflow-x-auto rounded-lg border border-(--p-panel-border-color) bg-comfy-menu-bg"
            >
              <slot name="bottom-panel" />
            </SplitterPanel>
          </Splitter>
        </SplitterPanel>

        <!-- Last panel: properties when left, sidebar when right -->
        <SplitterPanel
          v-if="lastPanelVisible"
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
          :size="SIDE_PANEL_SIZE"
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

const unifiedWidth = computed(() =>
  settingStore.get('Comfy.Sidebar.UnifiedWidth')
)

const { focusMode } = storeToRefs(workspaceStore)

const { isSelectMode, isBuilderMode } = useAppMode()
const { activeSidebarTabId, activeSidebarTab } = storeToRefs(sidebarTabStore)
const { bottomPanelVisible } = storeToRefs(useBottomPanelStore())
const { isOpen: rightSidePanelVisible } = storeToRefs(rightSidePanelStore)
const showOffsideSplitter = computed(
  () => rightSidePanelVisible.value || isSelectMode.value
)

const sidebarPanelVisible = computed(
  () => activeSidebarTab.value !== null && !isBuilderMode.value
)

const firstPanelVisible = computed(
  () =>
    !focusMode.value &&
    (sidebarLocation.value === 'left' || showOffsideSplitter.value)
)
const lastPanelVisible = computed(
  () =>
    !focusMode.value &&
    (sidebarLocation.value === 'right' || showOffsideSplitter.value)
)

/**
 * When both side panels are visible, reduce center panel default size so that
 * initial sizes sum to 100%. This prevents PrimeVue Splitter from saving an
 * inconsistent panelSizes array (where untouched panel values are prop-based
 * while resized panels are pixel-derived), which caused one panel's width to
 * drift when the other was resized.
 *
 * Uses runtime visibility (not just mount state) because the sidebar panel can
 * be mounted but hidden via display:none when no tab is active.
 */
const bothSidePanelsVisible = computed(
  () =>
    !focusMode.value && sidebarPanelVisible.value && showOffsideSplitter.value
)

const centerPanelDefaultSize = computed(() =>
  bothSidePanelsVisible.value ? 100 - 2 * SIDE_PANEL_SIZE : CENTER_PANEL_SIZE
)

const sidebarTabKey = computed(() => {
  return unifiedWidth.value
    ? 'unified-sidebar'
    : // When no tab is active, use a default key to maintain state
      (activeSidebarTabId.value ?? 'default-sidebar')
})

const sidebarStateKey = computed(() => {
  const base = sidebarTabKey.value
  if (sidebarLocation.value === 'left' && !showOffsideSplitter.value) {
    return base
  }
  const suffix = showOffsideSplitter.value ? '-with-offside' : ''
  return `${base}-${sidebarLocation.value}${suffix}`
})

/**
 * Avoid triggering default behaviors during drag-and-drop, such as text selection.
 */
function onResizestart({ originalEvent: event }: SplitterResizeStartEvent) {
  event.preventDefault()
}

/**
 * Normalize persisted panel sizes to sum to 100% after each resize.
 *
 * PrimeVue Splitter only updates the two panels adjacent to the dragged gutter,
 * leaving the third panel at its initial prop value. Because that prop value
 * doesn't account for CSS min-width or gutter offsets, the saved array can sum
 * to more than 100%, causing the untouched panel's width to drift on restore.
 */
function normalizeSavedSizes() {
  const stateKey = isSelectMode.value
    ? sidebarLocation.value === 'left'
      ? 'builder-splitter'
      : 'builder-splitter-right'
    : sidebarStateKey.value
  const raw = localStorage.getItem(stateKey)
  if (!raw) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.some((s) => typeof s !== 'number' || !Number.isFinite(s))
    ) {
      return
    }
    const sum = parsed.reduce((a, b) => a + b, 0)
    if (sum <= 0 || Math.abs(sum - 100) <= 0.5) return
    localStorage.setItem(
      stateKey,
      JSON.stringify(parsed.map((s) => (s / sum) * 100))
    )
  } catch {
    return
  }
}

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
