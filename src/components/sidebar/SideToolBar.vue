<template>
  <teleport to=".comfyui-body-left">
    <nav class="side-tool-bar-container">
      <SideBarIcon
        v-for="tab in tabs"
        :key="tab.id"
        :icon="tab.icon"
        :iconBadge="tab.iconBadge"
        :tooltip="tab.tooltip"
        :selected="tab === selectedTab"
        :class="tab.id + '-tab-button'"
        @click="onTabClick(tab)"
      />
      <div class="side-tool-bar-end">
        <SideBarThemeToggleIcon />
        <SideBarSettingsToggleIcon />
      </div>
    </nav>
  </teleport>
  <div v-if="selectedTab" class="sidebar-content-container">
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
import SideBarIcon from './SideBarIcon.vue'
import SideBarThemeToggleIcon from './SideBarThemeToggleIcon.vue'
import SideBarSettingsToggleIcon from './SideBarSettingsToggleIcon.vue'
import { computed, onBeforeUnmount } from 'vue'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import {
  CustomSidebarTabExtension,
  SidebarTabExtension
} from '@/types/extensionTypes'

const workspaceStore = useWorkspaceStore()
const tabs = computed(() => workspaceStore.getSidebarTabs())
const selectedTab = computed<SidebarTabExtension | null>(() => {
  const tabId = workspaceStore.activeSidebarTab
  return tabs.value.find((tab) => tab.id === tabId) || null
})
const mountCustomTab = (tab: CustomSidebarTabExtension, el: HTMLElement) => {
  tab.render(el)
}
const onTabClick = (item: SidebarTabExtension) => {
  workspaceStore.updateActiveSidebarTab(
    workspaceStore.activeSidebarTab === item.id ? null : item.id
  )
}
onBeforeUnmount(() => {
  tabs.value.forEach((tab) => {
    if (tab.type === 'custom' && tab.destroy) {
      tab.destroy()
    }
  })
})
</script>

<style>
:root {
  --sidebar-width: 64px;
  --sidebar-icon-size: 1.5rem;
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

.sidebar-content-container {
  height: 100%;
  overflow-y: auto;
}
</style>
