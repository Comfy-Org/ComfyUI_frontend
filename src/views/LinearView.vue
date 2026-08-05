<script setup lang="ts">
import { breakpointsTailwind, unrefElement, useBreakpoints } from '@vueuse/core'
import type { MaybeElement } from '@vueuse/core'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'

import AppBuilder from '@/components/builder/AppBuilder.vue'
import AppModeToolbar from '@/components/appMode/AppModeToolbar.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import { useSettingStore } from '@/platform/settings/settingStore'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import LinearProgressBar from '@/renderer/extensions/linearMode/LinearProgressBar.vue'
import MobileDisplay from '@/renderer/extensions/linearMode/MobileDisplay.vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAppMode } from '@/composables/useAppMode'
import { useStablePrimeVueSplitterSizer } from '@/composables/useStablePrimeVueSplitterSizer'
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
const assetsPanelCoach = computed(() =>
  activeTab.value?.id === 'assets' ? COACH_IDS.assetsPanel : undefined
)
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)
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

// Remount splitter when panel structure changes so initializePanels()
// properly sets flexBasis for the current set of panels.
const splitterKey = computed(() => {
  const left = hasLeftPanel.value ? 'L' : ''
  const right = hasRightPanel.value ? 'R' : ''
  return isArrangeMode.value ? 'arrange' : `app-${left}${right}`
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

const bottomLeftRef = useTemplateRef('bottomLeftRef')
const bottomRightRef = useTemplateRef('bottomRightRef')
const linearWorkflowRef = useTemplateRef('linearWorkflowRef')

function dragDrop(e: DragEvent) {
  const { dataTransfer } = e
  if (dataTransfer) linearWorkflowRef.value?.handleDragDrop()
}
</script>
<template>
  <MobileDisplay v-if="mobileDisplay" />
  <div v-else class="absolute flex size-full flex-col" @dragover.prevent>
    <div
      class="workflow-tabs-container pointer-events-auto h-(--workflow-tabs-height) w-full border-b border-interface-stroke shadow-interface"
    >
      <div class="flex h-full items-center">
        <WorkflowTabs />
        <TopbarBadges />
        <TopbarSubscribeButton />
      </div>
    </div>
    <div
      class="flex flex-1 overflow-hidden bg-secondary-background"
      :class="sidebarOnLeft ? 'flex-row' : 'flex-row-reverse'"
    >
      <SideToolbar
        v-if="!isBuilderMode"
        :visible-tab-ids="['assets', 'apps']"
        force-connected
        hide-workspace-toggles
      />
      <Splitter
        :key="splitterKey"
        class="h-full flex-1 border-none bg-secondary-background"
        @resizestart="$event.originalEvent.preventDefault()"
        @resizeend="onResizeEnd"
      >
        <SplitterPanel
          v-if="hasLeftPanel"
          ref="leftPanel"
          :size="SIDE_PANEL_SIZE"
          :min-size="
            sidePanelMinSize(showLeftBuilder, showRightBuilder && !activeTab)
          "
          :style="
            showRightBuilder && !activeTab ? { display: 'none' } : undefined
          "
          class="arrange-panel min-w-78 overflow-hidden bg-comfy-menu-bg outline-none"
        >
          <AppBuilder v-if="showLeftBuilder" />
          <div
            v-else-if="sidebarOnLeft && activeTab"
            v-coachmark="assetsPanelCoach"
            class="size-full overflow-x-hidden border-r border-border-subtle"
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
          v-coachmark="COACH_IDS.outputs"
          data-testid="linear-center-panel"
          :size="CENTER_PANEL_SIZE"
          class="relative flex min-w-[20vw] flex-col gap-4 text-muted-foreground outline-none"
          @drop="dragDrop"
        >
          <LinearProgressBar
            data-testid="linear-header-progress-bar"
            class="absolute top-0 left-0 z-21 h-1 w-[calc(100%+16px)]"
          />
          <LinearPreview
            :run-button-click="linearWorkflowRef?.runButtonClick"
          />
          <div class="absolute top-2 left-2 z-21">
            <AppModeToolbar v-if="!isBuilderMode" />
          </div>
          <div ref="bottomLeftRef" class="absolute bottom-7 left-4 z-20" />
          <div ref="bottomRightRef" class="absolute right-4 bottom-7 z-20" />
        </SplitterPanel>
        <SplitterPanel
          v-if="hasRightPanel"
          ref="rightPanel"
          :size="SIDE_PANEL_SIZE"
          :min-size="
            sidePanelMinSize(showRightBuilder, showLeftBuilder && !activeTab)
          "
          :style="
            showLeftBuilder && !activeTab ? { display: 'none' } : undefined
          "
          class="arrange-panel min-w-78 overflow-hidden bg-comfy-menu-bg outline-none"
        >
          <AppBuilder v-if="showRightBuilder" />
          <LinearControls
            v-else-if="sidebarOnLeft && !isArrangeMode"
            ref="linearWorkflowRef"
            :toast-to="unrefElement(bottomRightRef) ?? undefined"
          />
          <div
            v-else-if="activeTab"
            v-coachmark="assetsPanelCoach"
            class="h-full overflow-x-hidden border-l border-border-subtle"
          >
            <ExtensionSlot :extension="activeTab" />
          </div>
        </SplitterPanel>
      </Splitter>
    </div>
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
