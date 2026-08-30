<template>
  <div
    class="pointer-events-none absolute top-0 left-0 z-999 flex size-full flex-row"
  >
    <div
      class="pointer-events-none flex min-w-0 flex-1 flex-col overflow-hidden"
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
          class="pointer-events-none flex-1 overflow-hidden border-none bg-transparent"
          @layout="saveMainSplitterLayout"
        >
          <SplitterPanel
            v-if="firstPanelShown"
            id="first-side-panel"
            :order="1"
            :class="
              sidebarLocation === 'left'
                ? 'side-bar-panel pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
                : 'pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
            "
            :min-size="
              sidebarLocation === 'left' ? SIDEBAR_MIN_SIZE : BUILDER_MIN_SIZE
            "
            :default-size="firstPanelDefaultSize"
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
            v-if="firstPanelShown"
            class="pointer-events-auto"
          />

          <SplitterPanel
            id="main-panel"
            :order="2"
            :default-size="mainPanelDefaultSize"
            class="flex flex-col"
          >
            <slot name="topmenu" :sidebar-panel-visible />

            <SplitterGroup
              class="pointer-events-none mx-1 mb-1 h-auto flex-1 border-none bg-transparent"
              direction="vertical"
              @layout="saveBottomPanelLayout"
            >
              <SplitterPanel
                id="graph-canvas-panel"
                :order="1"
                :default-size="bottomPanelDefaultSizes[0]"
                class="graph-canvas-panel relative overflow-visible"
              >
                <slot name="graph-canvas-panel" />
              </SplitterPanel>
              <SplitterResizeHandle
                :class="
                  cn(
                    'pointer-events-auto translate-y-1 rounded-t-lg',
                    !(bottomPanelVisible && !focusMode) && 'hidden'
                  )
                "
              />
              <SplitterPanel
                v-show="bottomPanelVisible && !focusMode"
                id="bottom-panel"
                :order="2"
                :default-size="bottomPanelDefaultSizes[1]"
                class="bottom-panel pointer-events-auto max-w-full overflow-x-auto rounded-lg border border-border-default bg-comfy-menu-bg focus-visible:outline-hidden"
              >
                <slot name="bottom-panel" />
              </SplitterPanel>
            </SplitterGroup>
          </SplitterPanel>

          <SplitterResizeHandle
            v-if="lastPanelShown"
            class="pointer-events-auto"
          />
          <SplitterPanel
            v-if="lastPanelShown"
            id="last-side-panel"
            :order="3"
            :class="
              sidebarLocation === 'right'
                ? 'side-bar-panel pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
                : 'pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
            "
            :min-size="
              sidebarLocation === 'right' ? SIDEBAR_MIN_SIZE : BUILDER_MIN_SIZE
            "
            :default-size="lastPanelDefaultSize"
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

    <slot name="agent-panel" />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  SplitterGroup,
  SplitterPanel,
  SplitterResizeHandle
} from '@/components/ui/splitter'
import {
  loadSplitterSizes,
  saveSplitterSizes
} from '@/components/ui/splitter/persistence'
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
  () => sidebarLocation.value === 'left' || showOffsideSplitter.value
)
const lastPanelVisible = computed(
  () => sidebarLocation.value === 'right' || showOffsideSplitter.value
)
const firstPanelShown = computed(
  () =>
    firstPanelVisible.value &&
    !focusMode.value &&
    (sidebarLocation.value === 'right' || sidebarPanelVisible.value)
)
const lastPanelShown = computed(
  () =>
    lastPanelVisible.value &&
    !focusMode.value &&
    (sidebarLocation.value === 'left' || sidebarPanelVisible.value)
)

const bothSidePanelsVisible = computed(
  () =>
    !focusMode.value && sidebarPanelVisible.value && showOffsideSplitter.value
)

const centerPanelDefaultSize = computed(() =>
  bothSidePanelsVisible.value ? 100 - 2 * SIDE_PANEL_SIZE : CENTER_PANEL_SIZE
)

const sidebarTabKey = computed(() =>
  unifiedWidth.value
    ? 'unified-sidebar'
    : (activeSidebarTabId.value ?? 'default-sidebar')
)

const sidebarStateKey = computed(() => {
  const base = sidebarTabKey.value
  if (sidebarLocation.value === 'left' && !showOffsideSplitter.value) {
    return base
  }
  const suffix = showOffsideSplitter.value ? '-with-offside' : ''
  return `${base}-${sidebarLocation.value}${suffix}`
})

const mainSplitterStateKey = computed(() =>
  isSelectMode.value
    ? sidebarLocation.value === 'left'
      ? 'builder-splitter'
      : 'builder-splitter-right'
    : sidebarStateKey.value
)
const mainPanelCount = computed(
  () => 1 + Number(firstPanelShown.value) + Number(lastPanelShown.value)
)
const savedMainPanelSizes = computed(() =>
  loadSplitterSizes(mainSplitterStateKey.value, mainPanelCount.value)
)
const firstPanelDefaultSize = computed(
  () => savedMainPanelSizes.value?.[0] ?? SIDE_PANEL_SIZE
)
const mainPanelDefaultSize = computed(() => {
  const index = firstPanelShown.value ? 1 : 0
  return savedMainPanelSizes.value?.[index] ?? centerPanelDefaultSize.value
})
const lastPanelDefaultSize = computed(
  () => savedMainPanelSizes.value?.[mainPanelCount.value - 1] ?? SIDE_PANEL_SIZE
)

function saveMainSplitterLayout(sizes: number[]) {
  saveSplitterSizes(mainSplitterStateKey.value, sizes)
}

const bottomPanelStateKey = 'bottom-panel-splitter'
const bottomPanelDefaultSizes = loadSplitterSizes(bottomPanelStateKey, 2) ?? [
  50, 50
]

function saveBottomPanelLayout(sizes: number[]) {
  saveSplitterSizes(bottomPanelStateKey, sizes)
}

const splitterRefreshKey = computed(() => {
  return `main-splitter${rightSidePanelVisible.value ? '-with-right-panel' : ''}${isSelectMode.value ? '-builder' : ''}-${sidebarLocation.value}`
})
</script>
