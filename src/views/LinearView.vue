<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import type { MaybeElement } from '@vueuse/core'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed, useTemplateRef } from 'vue'

import ArrangeLayout from '@/components/builder/ArrangeLayout.vue'
import AppModeToolbar from '@/components/appMode/AppModeToolbar.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import LinearProgressBar from '@/renderer/extensions/linearMode/LinearProgressBar.vue'
import MobileDisplay from '@/renderer/extensions/linearMode/MobileDisplay.vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAppMode } from '@/composables/useAppMode'
import { useStablePrimeVueSplitterSizer } from '@/composables/useStablePrimeVueSplitterSizer'
import {
  CENTER_PANEL_SIZE,
  SIDEBAR_MIN_SIZE,
  SIDE_PANEL_SIZE
} from '@/constants/splitterConstants'

const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()
const { isBuilderMode } = useAppMode()

const mobileDisplay = useBreakpoints(breakpointsTailwind).smaller('md')
const activeTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)
const hasLeftPanel = computed(() => sidebarOnLeft.value && activeTab.value)
const hasRightPanel = computed(() => !sidebarOnLeft.value && activeTab.value)

const splitterKey = computed(() => {
  const left = hasLeftPanel.value ? 'L' : ''
  const right = hasRightPanel.value ? 'R' : ''
  return `app-${left}${right}`
})

const leftPanelRef = useTemplateRef<MaybeElement>('leftPanel')
const rightPanelRef = useTemplateRef<MaybeElement>('rightPanel')

const { onResizeEnd } = useStablePrimeVueSplitterSizer(
  [
    { ref: leftPanelRef, storageKey: 'Comfy.LinearView.LeftPanelWidth' },
    { ref: rightPanelRef, storageKey: 'Comfy.LinearView.RightPanelWidth' }
  ],
  [activeTab, splitterKey]
)
</script>
<template>
  <MobileDisplay v-if="mobileDisplay" />
  <div v-else class="absolute size-full">
    <div
      class="workflow-tabs-container pointer-events-auto h-(--workflow-tabs-height) w-full border-b border-interface-stroke shadow-interface"
    >
      <div class="flex h-full items-center">
        <WorkflowTabs />
        <TopbarBadges />
        <TopbarSubscribeButton />
      </div>
    </div>
    <Splitter
      :key="splitterKey"
      class="bg-comfy-menu-secondary-bg h-[calc(100%-var(--workflow-tabs-height))] w-full border-none"
      @resizestart="$event.originalEvent.preventDefault()"
      @resizeend="onResizeEnd"
    >
      <SplitterPanel
        v-if="hasLeftPanel"
        ref="leftPanel"
        :size="SIDE_PANEL_SIZE"
        :min-size="SIDEBAR_MIN_SIZE"
        class="min-w-78 overflow-hidden outline-none"
      >
        <div class="size-full overflow-x-hidden border-r border-border-subtle">
          <ExtensionSlot v-if="activeTab" :extension="activeTab" />
        </div>
      </SplitterPanel>
      <SplitterPanel
        id="linearCenterPanel"
        :size="CENTER_PANEL_SIZE"
        class="relative flex min-w-[20vw] flex-col gap-4 text-muted-foreground outline-none"
      >
        <LinearProgressBar
          class="absolute top-0 left-0 z-21 h-1 w-[calc(100%+16px)]"
        />
        <ArrangeLayout v-if="isBuilderMode" />
        <LinearPreview v-else />
        <div class="pointer-events-none absolute top-2 left-4.5 z-21">
          <AppModeToolbar v-if="!isBuilderMode" class="pointer-events-auto" />
        </div>
      </SplitterPanel>
      <SplitterPanel
        v-if="hasRightPanel"
        ref="rightPanel"
        :size="SIDE_PANEL_SIZE"
        :min-size="SIDEBAR_MIN_SIZE"
        class="min-w-78 overflow-hidden outline-none"
      >
        <div class="h-full overflow-x-hidden border-l border-border-subtle">
          <ExtensionSlot v-if="activeTab" :extension="activeTab" />
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>

<style scoped>
:deep(.p-splitter-gutter) {
  pointer-events: auto;
}

:deep(.p-splitter-gutter:hover),
:deep(.p-splitter-gutter[data-p-gutter-resizing='true']) {
  transition: background-color 0.2s ease 300ms;
  background-color: var(--p-primary-color);
}

/* Hide gutter next to hidden arrange panels */
:deep(.arrange-panel[style*='display: none'] + .p-splitter-gutter),
:deep(.p-splitter-gutter + .arrange-panel[style*='display: none']) {
  display: none;
}
</style>
