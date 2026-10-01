<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  breakpointsTailwind,
  unrefElement,
  useBreakpoints,
  useElementSize
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'

import AppBuilder from '@/components/builder/AppBuilder.vue'
import AppModeToolbar from '@/components/appMode/AppModeToolbar.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import SplitterGroup from '@/components/ui/splitter/SplitterGroup.vue'
import SplitterPanel from '@/components/ui/splitter/SplitterPanel.vue'
import SplitterResizeHandle from '@/components/ui/splitter/SplitterResizeHandle.vue'
import { usePanelSizing } from '@/components/ui/splitter/usePanelSizing'
import { COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import { useSettingStore } from '@/platform/settings/settingStore'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import LinearProgressBar from '@/renderer/extensions/linearMode/LinearProgressBar.vue'
import MobileDisplay from '@/renderer/extensions/linearMode/MobileDisplay.vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAppMode } from '@/composables/useAppMode'
import {
  BUILDER_MIN_SIZE,
  SIDEBAR_MIN_SIZE,
  SIDEBAR_MIN_WIDTH,
  SIDE_PANEL_SIZE,
  SIDE_TOOLBAR_WIDTH
} from '@/constants/splitterConstants'
import { useAppModeStore } from '@/stores/appModeStore'
import { useAgentDockMount } from '@/workbench/extensions/agent/composables/useAgentDockMount'

const settingStore = useSettingStore()
const { docked: agentDocked, DockedAgentPanel } = useAgentDockMount()
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
const leftPanelVisible = computed(
  () => hasLeftPanel.value && !(showRightBuilder.value && !activeTab.value)
)
const rightPanelVisible = computed(
  () => hasRightPanel.value && !(showLeftBuilder.value && !activeTab.value)
)

function sidePanelMinSize(isBuilder: boolean) {
  return Math.max(
    isBuilder ? BUILDER_MIN_SIZE : SIDEBAR_MIN_SIZE,
    panelWidth.value > 0 ? (SIDEBAR_MIN_WIDTH / panelWidth.value) * 100 : 0
  )
}

const panelComposition = computed(() => [
  ...(leftPanelVisible.value ? ['left'] : []),
  'center',
  ...(rightPanelVisible.value ? ['right'] : [])
])
const layoutMode = computed(() => (isArrangeMode.value ? 'arrange' : 'app'))
const workspaceRef = useTemplateRef('workspace')
const { width: workspaceWidth } = useElementSize(workspaceRef)
const panelWidth = computed(() =>
  Math.max(
    0,
    workspaceWidth.value -
      (isBuilderMode.value ? 0 : SIDE_TOOLBAR_WIDTH) -
      Number(leftPanelVisible.value) -
      Number(rightPanelVisible.value)
  )
)
const { sizes, layoutKey, panelRefs, onResizeStart, onResizeEnd } =
  usePanelSizing(
    [
      {
        id: 'linear-left-panel',
        storageKey: 'Comfy.LinearView.LeftPanelWidth',
        visible: () => Boolean(leftPanelVisible.value),
        minWidth: SIDEBAR_MIN_WIDTH,
        defaultWidth: () =>
          Math.max(
            SIDEBAR_MIN_WIDTH,
            (window.innerWidth * SIDE_PANEL_SIZE) / 100
          )
      },
      {
        id: 'linear-right-panel',
        storageKey: 'Comfy.LinearView.RightPanelWidth',
        visible: () => Boolean(rightPanelVisible.value),
        minWidth: SIDEBAR_MIN_WIDTH,
        defaultWidth: () =>
          Math.max(
            SIDEBAR_MIN_WIDTH,
            (window.innerWidth * SIDE_PANEL_SIZE) / 100
          )
      }
    ],
    panelWidth,
    () => window.innerWidth * 0.2
  )
const splitterKey = computed(
  () =>
    `${layoutMode.value}-${panelComposition.value.join('-')}-${layoutKey.value}`
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
      class="workflow-tabs-container pointer-events-auto h-(--workflow-tabs-height) w-full border-b border-interface-stroke/50 shadow-interface"
    >
      <WorkflowTabs />
    </div>
    <div class="flex min-h-0 flex-1 flex-row bg-secondary-background">
      <div
        ref="workspace"
        data-testid="linear-workspace-column"
        :class="
          cn(
            'flex min-w-0 flex-1 overflow-hidden',
            sidebarOnLeft ? 'flex-row' : 'flex-row-reverse'
          )
        "
      >
        <SideToolbar
          v-if="!isBuilderMode"
          :visible-tab-ids="['assets', 'apps']"
          force-connected
          hide-workspace-toggles
        />
        <SplitterGroup
          :key="splitterKey"
          class="h-full flex-1 border-none bg-secondary-background"
          @pointerdown.capture="onResizeStart"
          @keydown.capture="onResizeStart"
          @keyup="onResizeEnd"
        >
          <SplitterPanel
            v-if="leftPanelVisible"
            id="linear-left-panel"
            :ref="panelRefs.first"
            data-testid="linear-left-panel"
            :order="1"
            :default-size="sizes[0]"
            :min-size="sidePanelMinSize(showLeftBuilder)"
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
          <SplitterResizeHandle
            v-if="leftPanelVisible"
            @dragging="(dragging) => !dragging && onResizeEnd()"
          />
          <SplitterPanel
            id="linearCenterPanel"
            v-coachmark="COACH_IDS.outputs"
            :order="2"
            data-testid="linear-center-panel"
            :default-size="sizes[1]"
            :min-size="
              panelWidth > 0 ? ((workspaceWidth * 0.2) / panelWidth) * 100 : 0
            "
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
          <SplitterResizeHandle
            v-if="rightPanelVisible"
            @dragging="(dragging) => !dragging && onResizeEnd()"
          />
          <SplitterPanel
            v-if="rightPanelVisible"
            id="linear-right-panel"
            :ref="panelRefs.last"
            data-testid="linear-right-panel"
            :order="3"
            :default-size="sizes[2]"
            :min-size="sidePanelMinSize(showRightBuilder)"
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
        </SplitterGroup>
      </div>
      <!-- App mode hides the canvas, so the panel never meets bare graph. -->
      <component
        :is="DockedAgentPanel"
        v-if="agentDocked"
        :has-opaque-neighbor="true"
      />
    </div>
  </div>
</template>
