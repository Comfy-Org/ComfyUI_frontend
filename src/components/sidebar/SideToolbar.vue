<template>
  <nav
    ref="sideToolbarRef"
    class="side-tool-bar-container"
    :class="{
      'small-sidebar': isSmall,
      'connected-sidebar': selectedTab || isOverflowing,
      'floating-sidebar': !selectedTab && !isOverflowing,
      'overflowing-sidebar': isOverflowing
    }"
  >
    <div
      ref="contentMeasureRef"
      :class="
        isOverflowing
          ? 'side-tool-bar-container overflow-y-auto'
          : 'flex flex-col h-full'
      "
    >
      <div ref="topToolbarRef" class="sidebar-item-group">
        <ComfyMenuButton :is-small="isSmall" />
        <SidebarIcon
          v-for="tab in tabs"
          :key="tab.id"
          :icon="tab.icon"
          :icon-badge="tab.iconBadge"
          :tooltip="tab.tooltip"
          :tooltip-suffix="getTabTooltipSuffix(tab)"
          :label="tab.label || tab.title"
          :is-small="isSmall"
          :selected="tab.id === selectedTab?.id"
          :class="tab.id + '-tab-button'"
          @click="onTabClick(tab)"
        />
        <SidebarTemplatesButton />
      </div>

      <div ref="bottomToolbarRef" class="sidebar-item-group mt-auto">
        <SidebarLogoutIcon
          v-if="userStore.isMultiUserServer"
          :is-small="isSmall"
        />
        <SidebarHelpCenterIcon :is-small="isSmall" />
        <SidebarBottomPanelToggleButton :is-small="isSmall" />
        <SidebarShortcutsToggleButton :is-small="isSmall" />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { debounce } from 'es-toolkit/compat'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ComfyMenuButton from '@/components/sidebar/ComfyMenuButton.vue'
import SidebarBottomPanelToggleButton from '@/components/sidebar/SidebarBottomPanelToggleButton.vue'
import SidebarShortcutsToggleButton from '@/components/sidebar/SidebarShortcutsToggleButton.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useUserStore } from '@/stores/userStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'
import SidebarIcon from './SidebarIcon.vue'
import SidebarLogoutIcon from './SidebarLogoutIcon.vue'
import SidebarTemplatesButton from './SidebarTemplatesButton.vue'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const userStore = useUserStore()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const sideToolbarRef = ref<HTMLElement>()
const contentMeasureRef = ref<HTMLElement>()
const topToolbarRef = ref<HTMLElement>()
const bottomToolbarRef = ref<HTMLElement>()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const tabs = computed(() => workspaceStore.getSidebarTabs())
const selectedTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)

const onTabClick = async (item: SidebarTabExtension) =>
  await commandStore.commands
    .find((cmd) => cmd.id === `Workspace.ToggleSidebarTab.${item.id}`)
    ?.function?.()

const keybindingStore = useKeybindingStore()
const getTabTooltipSuffix = (tab: SidebarTabExtension) => {
  const keybinding = keybindingStore.getKeybindingByCommandId(
    `Workspace.ToggleSidebarTab.${tab.id}`
  )
  return keybinding ? ` (${keybinding.combo.toString()})` : ''
}

const isOverflowing = ref(false)

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
          canvasStore.canvas.fpsInfoLocation = [
            sideToolbarRef.value?.getBoundingClientRect()?.right,
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
  --sidebar-padding: 8px;
  --sidebar-icon-size: 1rem;

  --sidebar-default-floating-width: 56px;
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
@reference "tailwindcss";

.side-tool-bar-container {
  @apply flex flex-col items-center h-full bg-transparent;
}

.floating-sidebar {
  padding: var(--sidebar-padding);
}

.floating-sidebar .sidebar-item-group {
  @apply rounded-lg shadow-md;
  border-color: var(--p-panel-border-color);
}

.connected-sidebar {
  padding: var(--sidebar-padding) 0;
  background-color: var(--comfy-menu-bg);
}

.sidebar-item-group {
  @apply flex flex-col items-center overflow-hidden flex-shrink-0;
  background-color: var(--comfy-menu-bg);
  border: 1px solid transparent;
}

.overflowing-sidebar {
  @apply mr-2;
}

.overflowing-sidebar :deep(.comfy-menu-button-wrapper) {
  @apply sticky top-0 z-[1];
  background-color: var(--comfy-menu-bg);
}
</style>
