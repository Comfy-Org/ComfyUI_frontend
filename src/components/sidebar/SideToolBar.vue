<template>
  <teleport to=".comfyui-body-left">
    <nav class="side-tool-bar-container">
      <SideBarIcon
        v-for="tab in tabs"
        :key="tab.id"
        :icon="tab.icon"
        :tooltip="tab.tooltip"
        :selected="tab === selectedTab"
        @click="onTabClick(tab)"
      />
      <div class="side-tool-bar-end">
        <SideBarThemeToggleIcon />
        <SideBarSettingsToggleIcon />
      </div>
    </nav>
  </teleport>
  <div v-if="!selectedTab"></div>
  <component
    v-else-if="selectedTab.type === 'vue'"
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
          );
      }
    "
  ></div>
</template>

<script setup lang="ts">
import SideBarIcon from "./SideBarIcon.vue";
import SideBarThemeToggleIcon from "./SideBarThemeToggleIcon.vue";
import SideBarSettingsToggleIcon from "./SideBarSettingsToggleIcon.vue";
import { computed, onBeforeUnmount, watch } from "vue";
import { useSettingStore } from "@/stores/settingStore";
import { app } from "@/scripts/app";
import { useWorkspaceStore } from "@/stores/workspaceStateStore";
import {
  CustomSidebarTabExtension,
  SidebarTabExtension,
} from "@/types/extensionTypes";

const workspaceStateStore = useWorkspaceStore();
const tabs = computed(() => app.extensionManager.getSidebarTabs());
const selectedTab = computed(() => {
  const tabId = workspaceStateStore.activeSidebarTab;
  return tabs.value.find((tab) => tab.id === tabId);
});
const mountCustomTab = (tab: CustomSidebarTabExtension, el: HTMLElement) => {
  tab.render(el);
};
const onTabClick = (item: SidebarTabExtension) => {
  workspaceStateStore.updateActiveSidebarTab(
    workspaceStateStore.activeSidebarTab === item.id ? null : item.id
  );
};

const betaMenuEnabled = computed(
  () => useSettingStore().get("Comfy.UseNewMenu") !== "Disabled"
);
watch(betaMenuEnabled, (newValue) => {
  if (!newValue) {
    workspaceStateStore.updateActiveSidebarTab(null);
  }
});
onBeforeUnmount(() => {
  tabs.value.forEach((tab) => {
    if (tab.type === "custom" && tab.destroy) {
      tab.destroy();
    }
  });
});
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
</style>
