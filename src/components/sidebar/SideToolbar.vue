<template>
  <teleport :to="teleportTarget">
    <nav class="side-tool-bar-container" :class="{ 'small-sidebar': isSmall }">
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
      <div class="side-tool-bar-end">
        <SidebarLogoutIcon v-if="userStore.isMultiUserServer" />
        <SidebarHelpCenterIcon />
        <SidebarBottomPanelToggleButton />
        <SidebarShortcutsToggleButton />
      </div>
    </nav>
  </teleport>
  <div
    v-if="selectedTab"
    class="sidebar-content-container h-full overflow-y-auto overflow-x-hidden"
  >
    <ExtensionSlot :extension="selectedTab" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import SidebarBottomPanelToggleButton from '@/components/sidebar/SidebarBottomPanelToggleButton.vue'
import SidebarShortcutsToggleButton from '@/components/sidebar/SidebarShortcutsToggleButton.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useUserStore } from '@/stores/userStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { useKeybindingStore } from '@/workbench/keybindings/stores/keybindingStore'

import SidebarHelpCenterIcon from './SidebarHelpCenterIcon.vue'
import SidebarIcon from './SidebarIcon.vue'
import SidebarLogoutIcon from './SidebarLogoutIcon.vue'
import SidebarTemplatesButton from './SidebarTemplatesButton.vue'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()
const userStore = useUserStore()

const teleportTarget = computed(() =>
  settingStore.get('Comfy.Sidebar.Location') === 'left'
    ? '.comfyui-body-left'
    : '.comfyui-body-right'
)

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

const tabs = computed(() => workspaceStore.getSidebarTabs())
const selectedTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)
const onTabClick = (item: SidebarTabExtension) => {
  workspaceStore.sidebarTab.toggleSidebarTab(item.id)
}
const keybindingStore = useKeybindingStore()
const getTabTooltipSuffix = (tab: SidebarTabExtension) => {
  const keybinding = keybindingStore.getKeybindingByCommandId(
    `Workspace.ToggleSidebarTab.${tab.id}`
  )
  return keybinding ? ` (${keybinding.combo.toString()})` : ''
}
</script>

<style>
/* Global CSS variables for sidebar
 * These variables need to be global (not scoped) because they are used by
 * teleported components like WhatsNewPopup that render outside the sidebar
 * but need to reference sidebar dimensions for proper positioning.
 */
:root {
  --sidebar-width: 4rem;
  --sidebar-icon-size: 1rem;
}

:root:has(.side-tool-bar-container.small-sidebar) {
  --sidebar-width: 2.5rem;
}
</style>

<style scoped>
.side-tool-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;

  width: var(--sidebar-width);
  height: 100%;

  background-color: var(--comfy-menu-secondary-bg);
  color: var(--fg-color);
  box-shadow: var(--bar-shadow);
}

.side-tool-bar-container.small-sidebar {
  --sidebar-width: 2.5rem;
  --sidebar-icon-size: 1rem;
}

.side-tool-bar-end {
  align-self: flex-end;
  margin-top: auto;
}
</style>
