<template>
  <teleport :to="teleportTarget">
    <nav :class="'side-tool-bar-container' + (isSmall ? ' small-sidebar' : '')">
      <SidebarIcon
        v-for="tab in tabs"
        :key="tab.id"
        :icon="tab.icon"
        :iconBadge="tab.iconBadge"
        :tooltip="tab.tooltip + getTabTooltipSuffix(tab)"
        :selected="tab.id === selectedTab?.id"
        :class="tab.id + '-tab-button'"
        @click="onTabClick(tab)"
      />
      <div class="side-tool-bar-end">
        <SidebarThemeToggleIcon />
        <SidebarSettingsToggleIcon />
      </div>
    </nav>
  </teleport>
  <div
    v-if="selectedTab"
    class="sidebar-content-container h-full overflow-y-auto overflow-x-hidden"
  >
    <component v-if="selectedTab.type === 'vue'" :is="selectedTab.component" />
    <div
      v-else
      :ref="
        (el) => {
          if (el)
            mountCustomTab(
              selectedTab as CustomSidebarTabExtension,
              el as HTMLElement
            )
        }
      "
    ></div>
  </div>
</template>

<script setup lang="ts">
import SidebarIcon from './SidebarIcon.vue'
import SidebarThemeToggleIcon from './SidebarThemeToggleIcon.vue'
import SidebarSettingsToggleIcon from './SidebarSettingsToggleIcon.vue'
import { computed, onBeforeUnmount } from 'vue'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import { useSettingStore } from '@/stores/settingStore'
import {
  CustomSidebarTabExtension,
  SidebarTabExtension
} from '@/types/extensionTypes'
import { useKeybindingStore } from '@/stores/keybindingStore'

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()

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
const mountCustomTab = (tab: CustomSidebarTabExtension, el: HTMLElement) => {
  tab.render(el)
}
const onTabClick = (item: SidebarTabExtension) => {
  workspaceStore.sidebarTab.toggleSidebarTab(item.id)
}
onBeforeUnmount(() => {
  tabs.value.forEach((tab) => {
    if (tab.type === 'custom' && tab.destroy) {
      tab.destroy()
    }
  })
})

const keybindingStore = useKeybindingStore()
const getTabTooltipSuffix = (tab: SidebarTabExtension) => {
  const keybinding = keybindingStore.getKeybindingByCommandId(
    `Workspace.ToggleSidebarTab.${tab.id}`
  )
  return keybinding ? ` (${keybinding.combo.toString()})` : ''
}
</script>

<style>
:root {
  --sidebar-width: 64px;
  --sidebar-icon-size: 1.5rem;
}
:root .small-sidebar {
  --sidebar-width: 40px;
  --sidebar-icon-size: 1rem;
}
</style>

<style scoped>
.side-tool-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;

  pointer-events: auto;

  width: var(--sidebar-width);
  height: 100%;

  background-color: var(--comfy-menu-bg);
  color: var(--fg-color);
}

.side-tool-bar-end {
  align-self: flex-end;
  margin-top: auto;
}
</style>
