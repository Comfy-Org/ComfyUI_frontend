<template>
  <div
    class="SideToolbar side-tool-bar-container bg-zinc-950 flex-1 py-1 fixed z-[500] w-12 top-10 h-[calc(100vh-2.5rem)] flex flex-col items-center justify-between"
    :class="isSmall ? ' small-sidebar' : ''"
  >
    <nav class="flex flex-col items-center space-y-1">
      <SidebarIcon
        v-for="tab in tabs"
        :key="tab.id"
        :icon="tab.icon"
        :iconBadge="tab.iconBadge"
        :tooltip="tab.tooltip"
        :selected="tab === selectedTab"
        :class="tab.id + '-tab-button'"
        @click="onTabClick(tab)"
      />
    </nav>
    <div class="flex-1">
      <!-- dummy -->
    </div>
    <nav class="flex-1 flex flex-col items-center justify-end space-y-1">
      <SidebarThemeToggleIcon />
      <SidebarSettingsToggleIcon />
    </nav>
  </div>

  <teleport to="#modals">
    <div
      v-if="selectedTab"
      class="duration-300 fixed z-50 left-11 top-10 w-84 h-[calc(100vh-2.5rem)]"
    >
      <component
        v-if="selectedTab.type === 'vue'"
        :is="selectedTab.component"
      />
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
  </teleport>
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

const workspaceStore = useWorkspaceStore()
const settingStore = useSettingStore()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

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

<style scoped>
.side-tool-bar-container {
  /*
  background-color: var(--comfy-menu-bg);
  color: var(--comfyui-text-color);
  */
}

.sidebar-content-container {
  height: 100%;
  overflow-y: auto;
  background-color: var(--comfy-menu-bg);
  color: var(--fg-color);
}
</style>
