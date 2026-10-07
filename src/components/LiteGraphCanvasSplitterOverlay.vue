<template>
  <div
    class="pointer-events-none absolute top-0 left-0 z-999 flex size-full flex-col"
  >
    <slot name="workflow-tabs" />

    <div class="pointer-events-none flex min-h-0 flex-1 flex-row">
      <div
        :class="
          cn(
            'pointer-events-none flex min-w-0 flex-1 overflow-hidden',
            sidebarLocation === 'left' ? 'flex-row' : 'flex-row-reverse'
          )
        "
      >
        <div class="side-toolbar-container">
          <slot name="side-toolbar" />
        </div>

        <div
          ref="mainSplitterRef"
          class="pointer-events-none min-w-0 flex-1 overflow-hidden"
        >
          <SplitterGroup
            class="pointer-events-none border-none bg-transparent"
            @keydown.capture="onResizeStart"
            @keyup="onResizeEnd"
            @focusout="onResizeEnd"
            @layout="saveMainSplitterLayout"
          >
            <SplitterPanel
              v-if="firstPanelMounted"
              v-show="firstPanelRendered"
              id="first-side-panel"
              :key="isSelectMode ? mainSplitterStateKey : 'first-side-panel'"
              :ref="panelRefs.first"
              :order="1"
              :class="
                sidebarLocation === 'left'
                  ? 'side-bar-panel pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
                  : 'pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
              "
              :min-size="
                sidebarLocation === 'left'
                  ? sidebarMinSize
                  : isSelectMode
                    ? BUILDER_MIN_SIZE
                    : propertiesMinSize
              "
              :default-size="firstPanelDefaultSize"
              :role="sidebarLocation === 'left' ? 'complementary' : undefined"
              :aria-label="
                sidebarLocation === 'left'
                  ? t('sideToolbar.sidebar')
                  : undefined
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
              v-if="firstPanelMounted"
              :disabled="!firstPanelRendered"
              :tabindex="firstPanelRendered ? 0 : -1"
              :class="
                cn(
                  'pointer-events-auto',
                  !firstPanelRendered && 'hidden',
                  sidebarLocation === 'left' && 'bg-interface-stroke/50'
                )
              "
              @dragging="onResizeDragging($event, 'first-side-panel')"
            />

            <SplitterPanel
              id="main-panel"
              :order="2"
              :min-size="isSelectMode ? 0 : centerMinSize"
              :default-size="centerPanelDefaultSize"
              class="flex flex-col"
            >
              <div
                :class="!graphMeetsAgentPanel && 'mr-(--comfy-canvas-gutter)'"
              >
                <slot name="topmenu" :sidebar-panel-visible />
              </div>

              <SplitterGroup
                data-testid="graph-canvas-gutter"
                :class="
                  cn(
                    'pointer-events-none mb-(--comfy-canvas-gutter) ml-(--comfy-canvas-gutter) h-auto flex-1 border-none bg-transparent',
                    !graphMeetsAgentPanel && 'mr-(--comfy-canvas-gutter)'
                  )
                "
                direction="vertical"
                style="width: auto"
                @layout="saveBottomPanelLayout"
              >
                <SplitterPanel
                  id="graph-canvas-panel"
                  :order="1"
                  :default-size="bottomPanelDefaultSizes[0]"
                  class="graph-canvas-panel relative overflow-visible [anchor-name:--graph-canvas-panel]"
                >
                  <slot name="graph-canvas-panel" />
                </SplitterPanel>
                <SplitterResizeHandle
                  :disabled="!bottomPanelRendered"
                  :tabindex="bottomPanelRendered ? 0 : -1"
                  :class="
                    cn(
                      'pointer-events-auto translate-y-1 rounded-t-lg',
                      !bottomPanelRendered && 'hidden'
                    )
                  "
                  @dragging="!$event && flushLayouts()"
                />
                <SplitterPanel
                  v-show="bottomPanelRendered"
                  id="bottom-panel"
                  :order="2"
                  :default-size="bottomPanelDefaultSizes[1]"
                  class="bottom-panel pointer-events-auto max-w-full overflow-x-auto rounded-lg border border-interface-stroke bg-comfy-menu-bg focus-visible:outline-hidden"
                >
                  <slot name="bottom-panel" />
                </SplitterPanel>
              </SplitterGroup>
            </SplitterPanel>

            <SplitterResizeHandle
              v-if="lastPanelMounted"
              :disabled="!lastPanelRendered"
              :tabindex="lastPanelRendered ? 0 : -1"
              :class="
                cn(
                  'pointer-events-auto',
                  !lastPanelRendered && 'hidden',
                  sidebarLocation === 'right' && 'bg-interface-stroke/50'
                )
              "
              @dragging="onResizeDragging($event, 'last-side-panel')"
            />
            <SplitterPanel
              v-if="lastPanelMounted"
              v-show="lastPanelRendered"
              id="last-side-panel"
              :key="isSelectMode ? mainSplitterStateKey : 'last-side-panel'"
              :ref="panelRefs.last"
              :order="3"
              :class="
                sidebarLocation === 'right'
                  ? 'side-bar-panel pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
                  : 'pointer-events-auto bg-comfy-menu-bg focus-visible:outline-hidden'
              "
              :min-size="
                sidebarLocation === 'right'
                  ? sidebarMinSize
                  : isSelectMode
                    ? BUILDER_MIN_SIZE
                    : propertiesMinSize
              "
              :default-size="lastPanelDefaultSize"
              :role="sidebarLocation === 'right' ? 'complementary' : undefined"
              :aria-label="
                sidebarLocation === 'right'
                  ? t('sideToolbar.sidebar')
                  : undefined
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

      <slot
        name="agent-panel"
        :has-opaque-neighbor="agentPanelHasOpaqueNeighbor"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementSize } from '@vueuse/core'
import { debounce } from 'es-toolkit/compat'
import { storeToRefs } from 'pinia'
import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import SplitterGroup from '@/components/ui/splitter/SplitterGroup.vue'
import SplitterPanel from '@/components/ui/splitter/SplitterPanel.vue'
import SplitterResizeHandle from '@/components/ui/splitter/SplitterResizeHandle.vue'
import { useAppMode } from '@/composables/useAppMode'
import { usePanelSizing } from '@/composables/usePanelSizing'
import {
  BUILDER_MIN_SIZE,
  CENTER_PANEL_MIN_WIDTH,
  CENTER_PANEL_SIZE,
  PROPERTIES_PANEL_MIN_WIDTH,
  SIDEBAR_MIN_SIZE,
  SIDEBAR_MIN_WIDTH,
  SIDE_PANEL_SIZE,
  SIDE_TOOLBAR_WIDTH
} from '@/constants/splitterConstants'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  loadSplitterSizes,
  saveSplitterSizes
} from '@/utils/splitterPersistence'
import { savedPanelPercent } from '@/utils/splitterWidthUtil'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const rightSidePanelStore = useRightSidePanelStore()
const sidebarTabStore = useSidebarTabStore()
const agentPanelStore = useAgentPanelStore()
const { t } = useI18n()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const unifiedWidth = computed(() =>
  settingStore.get('Comfy.Sidebar.UnifiedWidth')
)

const { focusMode } = storeToRefs(workspaceStore)
const { isPickingNodes: agentNodeSelectionActive } =
  storeToRefs(useCanvasStore())

const { isSelectMode, isBuilderMode } = useAppMode()
const { activeSidebarTabId, activeSidebarTab } = storeToRefs(sidebarTabStore)
const { bottomPanelVisible } = storeToRefs(useBottomPanelStore())
const { isOpen: rightSidePanelVisible } = storeToRefs(rightSidePanelStore)
const { isVisible: agentPanelOpen } = storeToRefs(agentPanelStore)
const oppositeSidePanelVisible = computed(
  () => rightSidePanelVisible.value || isSelectMode.value
)

const agentPanelHasOpaqueNeighbor = computed(
  () =>
    (sidebarLocation.value === 'right' &&
      sidebarPanelVisible.value &&
      !agentNodeSelectionActive.value &&
      !focusMode.value) ||
    (sidebarLocation.value === 'left' &&
      oppositeSidePanelVisible.value &&
      !agentNodeSelectionActive.value &&
      !focusMode.value)
)

/**
 * The graph's right gutter is what separates it from whatever is drawn beside
 * it. When that is the agent panel, the panel's own gutter already spaces the
 * two and a second one reads as a gap.
 */
const graphMeetsAgentPanel = computed(
  () => agentPanelOpen.value && !agentPanelHasOpaqueNeighbor.value
)

const sidebarPanelVisible = computed(
  () => activeSidebarTab.value !== null && !isBuilderMode.value
)

watchEffect(() => {
  agentPanelStore.setReservedWorkspaceWidth(
    SIDE_TOOLBAR_WIDTH +
      (sidebarPanelVisible.value &&
      !focusMode.value &&
      !agentNodeSelectionActive.value
        ? SIDEBAR_MIN_WIDTH
        : 0)
  )
})

const firstPanelVisible = computed(
  () => sidebarLocation.value === 'left' || oppositeSidePanelVisible.value
)
const lastPanelVisible = computed(
  () => sidebarLocation.value === 'right' || oppositeSidePanelVisible.value
)
const firstPanelMounted = computed(
  () =>
    firstPanelVisible.value &&
    (sidebarLocation.value === 'right' || sidebarPanelVisible.value)
)
const lastPanelMounted = computed(
  () =>
    lastPanelVisible.value &&
    (sidebarLocation.value === 'left' || sidebarPanelVisible.value)
)
const firstPanelRendered = computed(
  () =>
    firstPanelMounted.value &&
    !focusMode.value &&
    !agentNodeSelectionActive.value
)
const lastPanelRendered = computed(
  () =>
    lastPanelMounted.value &&
    !focusMode.value &&
    !agentNodeSelectionActive.value
)
const bottomPanelRendered = computed(
  () =>
    bottomPanelVisible.value &&
    !focusMode.value &&
    !agentNodeSelectionActive.value
)

const bothSidePanelsVisible = computed(
  () =>
    !focusMode.value &&
    sidebarPanelVisible.value &&
    oppositeSidePanelVisible.value
)

const mainSplitterRef = ref<HTMLElement | null>(null)
const { width: mainSplitterWidth } = useElementSize(mainSplitterRef)
const availableSplitterWidth = computed(() =>
  Math.max(
    0,
    mainSplitterWidth.value -
      Number(firstPanelRendered.value) -
      Number(lastPanelRendered.value)
  )
)
const centerMinSize = computed(() =>
  availableSplitterWidth.value > 0
    ? (CENTER_PANEL_MIN_WIDTH / availableSplitterWidth.value) * 100
    : 0
)
const sidebarMinSize = computed(() =>
  availableSplitterWidth.value
    ? (SIDEBAR_MIN_WIDTH / availableSplitterWidth.value) * 100
    : SIDEBAR_MIN_SIZE
)
const propertiesMinSize = computed(() =>
  availableSplitterWidth.value
    ? (PROPERTIES_PANEL_MIN_WIDTH / availableSplitterWidth.value) * 100
    : BUILDER_MIN_SIZE
)

const centerPanelFallbackSize = computed(() =>
  bothSidePanelsVisible.value ? 100 - 2 * SIDE_PANEL_SIZE : CENTER_PANEL_SIZE
)

const sidebarTabKey = computed(() =>
  unifiedWidth.value
    ? 'unified-sidebar'
    : (activeSidebarTabId.value ?? 'default-sidebar')
)

const sidebarStateKey = computed(() => {
  const base = sidebarTabKey.value
  if (sidebarLocation.value === 'left' && !oppositeSidePanelVisible.value) {
    return base
  }
  const suffix = oppositeSidePanelVisible.value ? '-with-offside' : ''
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
  () => 1 + Number(firstPanelMounted.value) + Number(lastPanelMounted.value)
)
const savedMainPanelSizes = shallowRef<number[]>()
const persistMainLayout = debounce(saveSplitterSizes, 100)
const persistBottomLayout = debounce(saveSplitterSizes, 100)

function flushLayouts() {
  persistMainLayout.flush()
  persistBottomLayout.flush()
}

onBeforeUnmount(flushLayouts)
watch(mainSplitterStateKey, () => persistMainLayout.flush(), { flush: 'sync' })
watch(
  [mainSplitterStateKey, mainPanelCount],
  ([key, count]) => {
    savedMainPanelSizes.value = loadSplitterSizes(key, count)
  },
  { immediate: true }
)
const sidebarWidthKey = computed(() => {
  const base =
    sidebarLocation.value === 'left'
      ? 'Comfy.Sidebar.LeftWidth'
      : 'Comfy.Sidebar.RightWidth'
  return unifiedWidth.value ? base : `${base}.${sidebarTabKey.value}`
})
function defaultPanelWidth(isSidebarPanel: boolean) {
  const plainStateKey =
    sidebarLocation.value === 'left'
      ? sidebarTabKey.value
      : `${sidebarTabKey.value}-right`
  const offsideStateKey = `${sidebarTabKey.value}-${sidebarLocation.value}-with-offside`
  const stateKeys = isSidebarPanel
    ? oppositeSidePanelVisible.value
      ? [offsideStateKey, plainStateKey]
      : [plainStateKey, offsideStateKey]
    : [offsideStateKey]
  const edge =
    (sidebarLocation.value === 'left') === isSidebarPanel ? 'first' : 'last'
  const percent =
    savedPanelPercent((key) => localStorage.getItem(key), stateKeys, edge) ??
    SIDE_PANEL_SIZE
  return Math.max(
    isSidebarPanel ? SIDEBAR_MIN_WIDTH : PROPERTIES_PANEL_MIN_WIDTH,
    Math.round((percent / 100) * (window.innerWidth - SIDE_TOOLBAR_WIDTH))
  )
}
const {
  panelPercentages,
  panelRefs,
  onResizeStart,
  onResizeDragging: updatePanelResize,
  onResizeEnd: savePanelWidth
} = usePanelSizing(
  [
    {
      id: 'first-side-panel',
      storageKey: () =>
        sidebarLocation.value === 'left'
          ? sidebarWidthKey.value
          : 'Comfy.RightSidePanel.Width',
      visible: () => firstPanelRendered.value && !isSelectMode.value,
      minWidth: () =>
        sidebarLocation.value === 'left'
          ? SIDEBAR_MIN_WIDTH
          : PROPERTIES_PANEL_MIN_WIDTH,
      defaultWidth: () => defaultPanelWidth(sidebarLocation.value === 'left')
    },
    {
      id: 'last-side-panel',
      storageKey: () =>
        sidebarLocation.value === 'right'
          ? sidebarWidthKey.value
          : 'Comfy.RightSidePanel.Width',
      visible: () => lastPanelRendered.value && !isSelectMode.value,
      minWidth: () =>
        sidebarLocation.value === 'right'
          ? SIDEBAR_MIN_WIDTH
          : PROPERTIES_PANEL_MIN_WIDTH,
      defaultWidth: () => defaultPanelWidth(sidebarLocation.value === 'right')
    }
  ],
  availableSplitterWidth,
  CENTER_PANEL_MIN_WIDTH
)

function onResizeEnd() {
  savePanelWidth()
  flushLayouts()
}

function onResizeDragging(dragging: boolean, panelId: string) {
  updatePanelResize(dragging, panelId)
  if (!dragging) flushLayouts()
}

const firstPanelDefaultSize = computed(() =>
  !isSelectMode.value
    ? panelPercentages.value[0]
    : (savedMainPanelSizes.value?.[0] ??
      (sidebarLocation.value === 'left'
        ? Math.max(SIDE_PANEL_SIZE, sidebarMinSize.value)
        : SIDE_PANEL_SIZE))
)
const centerPanelDefaultSize = computed(() => {
  if (!isSelectMode.value) return panelPercentages.value[1]
  const index = firstPanelRendered.value ? 1 : 0
  return savedMainPanelSizes.value?.[index] ?? centerPanelFallbackSize.value
})
const lastPanelDefaultSize = computed(() =>
  !isSelectMode.value
    ? panelPercentages.value[2]
    : (savedMainPanelSizes.value?.[mainPanelCount.value - 1] ??
      (sidebarLocation.value === 'right'
        ? Math.max(SIDE_PANEL_SIZE, sidebarMinSize.value)
        : SIDE_PANEL_SIZE))
)

function saveMainSplitterLayout(sizes: number[]) {
  if (!isSelectMode.value || sizes.length === 1) return
  savedMainPanelSizes.value = sizes
  persistMainLayout(mainSplitterStateKey.value, sizes)
}

const bottomPanelStateKey = 'bottom-panel-splitter'
const bottomPanelDefaultSizes = shallowRef(
  loadSplitterSizes(bottomPanelStateKey, 2) ?? [50, 50]
)

function saveBottomPanelLayout(sizes: number[]) {
  bottomPanelDefaultSizes.value = sizes
  persistBottomLayout(bottomPanelStateKey, sizes)
}
</script>
