<script setup lang="ts">
import { breakpointsTailwind, unrefElement, useBreakpoints } from '@vueuse/core'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'

import AppBuilder from '@/components/builder/AppBuilder.vue'
import AppModeToolbar from '@/components/appMode/AppModeToolbar.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@/utils/tailwindUtil'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import LinearProgressBar from '@/renderer/extensions/linearMode/LinearProgressBar.vue'
import MobileDisplay from '@/renderer/extensions/linearMode/MobileDisplay.vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAppMode } from '@/composables/useAppMode'
import {
  BUILDER_MIN_SIZE,
  CENTER_PANEL_SIZE,
  SIDEBAR_MIN_SIZE,
  SIDE_PANEL_SIZE
} from '@/constants/splitterConstants'
import { useAppModeStore } from '@/stores/appModeStore'

const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()
const { isBuilderMode, isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)

const mobileDisplay = useBreakpoints(breakpointsTailwind).smaller('md')

const activeTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)
// Builder panel is always on the opposite side of the sidebar.
// In arrange mode we render 3 panels to match the overlay structure,
// so the same stateKey percentage maps to the same pixel width.
const showLeftBuilder = computed(
  () => !sidebarOnLeft.value && isArrangeMode.value
)
const showRightBuilder = computed(
  () => sidebarOnLeft.value && isArrangeMode.value
)
const hasLeftPanel = computed(
  () =>
    isArrangeMode.value ||
    (sidebarOnLeft.value && activeTab.value) ||
    (!sidebarOnLeft.value && !isBuilderMode.value && hasOutputs.value)
)
const hasRightPanel = computed(
  () =>
    isArrangeMode.value ||
    (sidebarOnLeft.value && !isBuilderMode.value && hasOutputs.value) ||
    (!sidebarOnLeft.value && activeTab.value)
)

function sidePanelMinSize(isBuilder: boolean, isHidden: boolean) {
  if (isBuilder) return BUILDER_MIN_SIZE
  if (isHidden) return undefined
  return SIDEBAR_MIN_SIZE
}

const TYPEFORM_WIDGET_ID = 'gmVqFi8l'

const bottomLeftRef = useTemplateRef('bottomLeftRef')
const bottomRightRef = useTemplateRef('bottomRightRef')
const linearWorkflowRef = useTemplateRef('linearWorkflowRef')
</script>
<template>
  <MobileDisplay v-if="mobileDisplay" />
  <div v-else class="absolute w-full h-full">
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
      :key="isArrangeMode ? 'arrange' : 'normal'"
      class="h-[calc(100%-var(--workflow-tabs-height))] w-full border-none bg-comfy-menu-secondary-bg"
      :state-key="isArrangeMode ? 'builder-splitter' : undefined"
      :state-storage="isArrangeMode ? 'local' : undefined"
      @resizestart="({ originalEvent }) => originalEvent.preventDefault()"
    >
      <SplitterPanel
        v-if="hasLeftPanel"
        id="linearLeftPanel"
        :size="isArrangeMode ? SIDE_PANEL_SIZE : 1"
        :min-size="
          sidePanelMinSize(showLeftBuilder, showRightBuilder && !activeTab)
        "
        :style="
          showRightBuilder && !activeTab ? { display: 'none' } : undefined
        "
        :class="
          cn(
            'outline-none arrange-panel',
            showLeftBuilder ? 'bg-comfy-menu-bg min-w-78' : 'min-w-min'
          )
        "
      >
        <div v-if="showLeftBuilder" class="h-full overflow-y-auto">
          <AppBuilder />
        </div>
        <div
          v-else-if="sidebarOnLeft && activeTab"
          class="flex h-full border-border-subtle border-r"
        >
          <ExtensionSlot :extension="activeTab" />
        </div>
        <LinearControls
          v-else-if="!isArrangeMode"
          ref="linearWorkflowRef"
          :toast-to="unrefElement(bottomLeftRef) ?? undefined"
        />
      </SplitterPanel>
      <SplitterPanel
        id="linearCenterPanel"
        :size="isArrangeMode ? CENTER_PANEL_SIZE : 98"
        class="flex flex-col min-w-0 gap-4 relative text-muted-foreground outline-none"
      >
        <LinearProgressBar
          class="absolute top-0 left-0 w-[calc(100%+16px)] z-21"
        />
        <LinearPreview
          :run-button-click="linearWorkflowRef?.runButtonClick"
          :typeform-widget-id="TYPEFORM_WIDGET_ID"
        />
        <div class="absolute z-21 top-4 left-4">
          <AppModeToolbar v-if="!isBuilderMode" />
        </div>
        <div ref="bottomLeftRef" class="absolute z-20 bottom-7 left-4" />
        <div ref="bottomRightRef" class="absolute z-20 bottom-7 right-4" />
      </SplitterPanel>
      <SplitterPanel
        v-if="hasRightPanel"
        id="linearRightPanel"
        :size="isArrangeMode ? SIDE_PANEL_SIZE : 1"
        :min-size="
          sidePanelMinSize(showRightBuilder, showLeftBuilder && !activeTab)
        "
        :style="showLeftBuilder && !activeTab ? { display: 'none' } : undefined"
        :class="
          cn(
            'outline-none arrange-panel',
            showRightBuilder ? 'bg-comfy-menu-bg min-w-78' : 'min-w-min'
          )
        "
      >
        <div v-if="showRightBuilder" class="h-full overflow-y-auto">
          <AppBuilder />
        </div>
        <LinearControls
          v-else-if="sidebarOnLeft && !isArrangeMode"
          ref="linearWorkflowRef"
          :toast-to="unrefElement(bottomRightRef) ?? undefined"
        />
        <div
          v-else-if="activeTab"
          class="flex h-full border-border-subtle border-l"
        >
          <ExtensionSlot :extension="activeTab" />
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
