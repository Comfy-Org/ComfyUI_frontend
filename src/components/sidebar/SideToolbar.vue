<template>
  <nav
    ref="sideToolbarRef"
    data-testid="side-toolbar"
    :inert="isHidden"
    :aria-hidden="isHidden"
    :class="
      cn(
        'side-tool-bar-container flex h-full flex-col items-center bg-transparent transition-[max-width,opacity,transform] duration-300 ease-in-out',
        {
          'small-sidebar': isSmall,
          'connected-sidebar pointer-events-auto': isConnected,
          'floating-sidebar py-(--comfy-canvas-gutter) [--sidebar-item-radius:var(--radius-lg)]':
            !isConnected,
          'ml-(--comfy-canvas-gutter)':
            !isConnected && sidebarLocation === 'left',
          'mr-(--comfy-canvas-gutter)':
            !isConnected && sidebarLocation === 'right',
          'overflowing-sidebar': isOverflowing,
          'border-r border-interface-stroke/50 shadow-interface': isConnected,
          'pointer-events-none overflow-hidden opacity-0': isHidden,
          '-translate-x-8': isHidden && sidebarLocation === 'left',
          'translate-x-8': isHidden && sidebarLocation === 'right'
        }
      )
    "
    :style="{ maxWidth }"
  >
    <div
      :class="
        isOverflowing
          ? 'side-tool-bar-container overflow-y-auto'
          : 'flex h-full flex-col'
      "
    >
      <div
        ref="topToolbarRef"
        data-testid="sidebar-top-group"
        :class="groupClasses"
      >
        <ComfyMenuButton />
        <SidebarIcon
          v-for="tab in tabs"
          :key="tab.id"
          :icon="tab.icon"
          :icon-badge="tab.iconBadge"
          :tooltip="tab.tooltip"
          :tooltip-suffix="getTabTooltipSuffix(tab)"
          :label="tab.label || tab.title"
          :is-small
          :selected="tab.id === selectedTab?.id"
          :data-testid="`${tab.id}-tab-button`"
          @click="onTabClick(tab)"
        />
        <SidebarTemplatesButton />
      </div>

      <div ref="bottomToolbarRef" :class="cn('mt-auto', groupClasses)">
        <SidebarLogoutIcon v-if="userStore.isMultiUserServer" :is-small />
        <SidebarHelpCenterIcon :is-small />
        <SidebarBottomPanelToggleButton
          v-if="!isCloud && !hideWorkspaceToggles"
          :is-small
        />
        <SidebarShortcutsToggleButton v-if="!hideWorkspaceToggles" :is-small />
        <SidebarSettingsButton :is-small />
      </div>
    </div>
    <HelpCenterPopups :is-small />
    <Suspense v-if="NightlySurveyController">
      <component :is="NightlySurveyController" />
    </Suspense>
  </nav>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { debounce } from 'es-toolkit/compat'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import HelpCenterPopups from '@/components/helpcenter/HelpCenterPopups.vue'
import ComfyMenuButton from '@/components/sidebar/ComfyMenuButton.vue'
import SidebarBottomPanelToggleButton from '@/components/sidebar/SidebarBottomPanelToggleButton.vue'
import SidebarSettingsButton from '@/components/sidebar/SidebarSettingsButton.vue'
import SidebarShortcutsToggleButton from '@/components/sidebar/SidebarShortcutsToggleButton.vue'
import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useCommandStore } from '@/stores/commandStore'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useUserStore } from '@/stores/userStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { cn } from '@comfyorg/tailwind-utils'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'
import SidebarIcon from './SidebarIcon.vue'
import SidebarLogoutIcon from './SidebarLogoutIcon.vue'
import SidebarTemplatesButton from './SidebarTemplatesButton.vue'

const {
  visibleTabIds,
  forceConnected = false,
  hideWorkspaceToggles = false
} = defineProps<{
  visibleTabIds?: string[]
  forceConnected?: boolean
  hideWorkspaceToggles?: boolean
}>()

const NightlySurveyController =
  isNightly && !isCloud && !isDesktop
    ? defineAsyncComponent(
        () => import('@/platform/surveys/NightlySurveyController.vue')
      )
    : undefined

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const userStore = useUserStore()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const agentNodeSelectionStore = useAgentNodeSelectionStore()
const sideToolbarRef = ref<HTMLElement>()
const topToolbarRef = ref<HTMLElement>()
const bottomToolbarRef = ref<HTMLElement>()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)
const sidebarStyle = computed(() => settingStore.get('Comfy.Sidebar.Style'))
const isConnected = computed(
  () =>
    forceConnected ||
    selectedTab.value ||
    isOverflowing.value ||
    sidebarStyle.value === 'connected'
)

const tabs = computed(() => {
  const all = workspaceStore.getSidebarTabs()
  return visibleTabIds
    ? all.filter((tab) => visibleTabIds.includes(tab.id))
    : all
})
const selectedTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)
const isHidden = computed(() => agentNodeSelectionStore.isActionBarsHidden)
const maxWidth = computed(() => {
  if (isHidden.value) return '0px'
  if (isConnected.value) return 'var(--sidebar-width)'
  return 'calc(var(--sidebar-width) + 2 * var(--sidebar-padding))'
})

/**
 * Handle sidebar tab icon click.
 * - Emits UI button telemetry for known tabs
 * - Delegates to the corresponding toggle command
 */
const onTabClick = async (item: SidebarTabExtension) => {
  const telemetry = useTelemetry()

  const isNodeLibraryTab = item.id === 'node-library'
  const isModelLibraryTab = item.id === 'model-library'
  const isWorkflowsTab = item.id === 'workflows'
  const isAssetsTab = item.id === 'assets'

  if (isNodeLibraryTab)
    telemetry?.trackUiButtonClicked({
      button_id: 'sidebar_tab_node_library_selected',
      element_group: 'sidebar'
    })
  else if (isModelLibraryTab)
    telemetry?.trackUiButtonClicked({
      button_id: 'sidebar_tab_model_library_selected',
      element_group: 'sidebar'
    })
  else if (isWorkflowsTab)
    telemetry?.trackUiButtonClicked({
      button_id: 'sidebar_tab_workflows_selected',
      element_group: 'sidebar'
    })
  else if (isAssetsTab)
    telemetry?.trackUiButtonClicked({
      button_id: 'sidebar_tab_assets_media_selected',
      element_group: 'sidebar'
    })

  await commandStore.commands
    .find((cmd) => cmd.id === `Workspace.ToggleSidebarTab.${item.id}`)
    ?.function?.()
}

const keybindingStore = useKeybindingStore()
const getTabTooltipSuffix = (tab: SidebarTabExtension) => {
  const shortcut = keybindingStore
    .getKeybindingByCommandId(`Workspace.ToggleSidebarTab.${tab.id}`)
    ?.combo.toString()
  return shortcut ? t('g.shortcutSuffix', { shortcut }) : ''
}

const isOverflowing = ref(false)
const groupClasses = computed(() =>
  cn(
    'sidebar-item-group flex shrink-0 flex-col items-center overflow-hidden',
    !isConnected.value && 'pointer-events-auto floating-panel'
  )
)

const CANVAS_GUTTER_VAR = '--comfy-canvas-gutter'

/**
 * The canvas gutter in pixels. Custom properties come back from
 * `getComputedStyle` unresolved, so the token is measured through a length
 * property the browser does resolve.
 */
function canvasGutter(): number {
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.marginLeft = `var(${CANVAS_GUTTER_VAR})`
  document.body.append(probe)
  const px = parseFloat(getComputedStyle(probe).marginLeft)
  probe.remove()
  return Number.isFinite(px) ? px : 0
}

const ENTER_OVERFLOW_MARGIN = 20
const EXIT_OVERFLOW_MARGIN = 50

const checkOverflow = debounce(() => {
  if (!sideToolbarRef.value || !topToolbarRef.value || !bottomToolbarRef.value)
    return

  const containerHeight = sideToolbarRef.value.clientHeight
  const topHeight = topToolbarRef.value.scrollHeight
  const bottomHeight = bottomToolbarRef.value.scrollHeight
  const contentHeight = topHeight + bottomHeight

  if (isOverflowing.value) {
    isOverflowing.value = containerHeight < contentHeight + EXIT_OVERFLOW_MARGIN
  } else {
    isOverflowing.value =
      containerHeight < contentHeight + ENTER_OVERFLOW_MARGIN
  }
}, 16)

onMounted(() => {
  if (!sideToolbarRef.value) return

  const overflowObserver = useResizeObserver(
    sideToolbarRef.value,
    checkOverflow
  )

  checkOverflow()

  onBeforeUnmount(() => {
    overflowObserver.stop()
  })

  watch(
    [isSmall, sidebarLocation],
    async () => {
      if (canvasStore.canvas) {
        if (sidebarLocation.value === 'left') {
          await nextTick()
          const sidebarRight =
            sideToolbarRef.value?.getBoundingClientRect()?.right
          canvasStore.canvas.fpsInfoLocation = [
            sidebarRight === undefined
              ? undefined
              : sidebarRight + canvasGutter(),
            null
          ]
        } else {
          canvasStore.canvas.fpsInfoLocation = null
        }
        canvasStore.canvas.setDirty(false, true)
      }
    },
    { immediate: true }
  )
})
</script>

<style>
/* Global CSS variables for sidebar
 * These variables need to be global (not scoped) because they are used by
 * teleported components like WhatsNewPopup that render outside the sidebar
 * but need to reference sidebar dimensions for proper positioning.
 */
:root {
  --sidebar-padding: var(--spacing);
  --sidebar-icon-size: 1rem;

  --sidebar-default-floating-width: 48px;
  --sidebar-default-connected-width: calc(
    var(--sidebar-default-floating-width) + var(--sidebar-padding) * 2
  );
  --sidebar-default-item-height: 56px;

  --sidebar-small-floating-width: 48px;
  --sidebar-small-connected-width: calc(
    var(--sidebar-small-floating-width) + var(--sidebar-padding) * 2
  );
  --sidebar-small-item-height: 48px;

  --sidebar-width: var(--sidebar-default-floating-width);
  --sidebar-item-height: var(--sidebar-default-item-height);
}

:root:has(.side-tool-bar-container.small-sidebar) {
  --sidebar-width: var(--sidebar-small-floating-width);
  --sidebar-item-height: var(--sidebar-small-item-height);
}

:root:has(.side-tool-bar-container.connected-sidebar) {
  --sidebar-width: var(--sidebar-default-connected-width);
}

:root:has(.side-tool-bar-container.small-sidebar.connected-sidebar) {
  --sidebar-width: var(--sidebar-small-connected-width);
}
</style>

<style scoped>
.connected-sidebar {
  padding: var(--sidebar-padding) 0;
  background-color: var(--comfy-menu-bg);
}

.overflowing-sidebar :deep(.comfy-menu-button-wrapper) {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: var(--comfy-menu-bg);
}
</style>
