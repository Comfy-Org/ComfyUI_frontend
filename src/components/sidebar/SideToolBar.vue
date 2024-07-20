<template>
  <teleport to=".comfyui-body-left">
    <nav class="side-tool-bar-container">
      <SideBarIcon
        v-for="item in items"
        :icon="item.icon"
        :selected="item === selectedItem"
        @click="onItemClick(item)"
      />
      <div class="side-tool-bar-end">
        <SideBarThemeToggleIcon />
        <SideBarSettingsToggleIcon />
      </div>
    </nav>
  </teleport>
  <teleport to="#graph-canvas-container">
    <LiteGraphCanvasSplitterOverlay v-show="selectedItem !== null">
      <template #side-bar-panel>
        <component :is="selectedItem?.component" />
      </template>
    </LiteGraphCanvasSplitterOverlay>
  </teleport>
</template>

<script setup lang="ts">
import SideBarIcon from "./SideBarIcon.vue";
import SideBarThemeToggleIcon from "./SideBarThemeToggleIcon.vue";
import SideBarSettingsToggleIcon from "./SideBarSettingsToggleIcon.vue";
import LiteGraphCanvasSplitterOverlay from "@/components/LiteGraphCanvasSplitterOverlay.vue";
import NodeDetailSideBarItem from "./items/NodeDetailSideBarItem.vue";
import { markRaw, ref } from "vue";

const items = ref([
  { icon: "pi pi-map", component: markRaw(NodeDetailSideBarItem) },
  { icon: "pi pi-search" },
]);
const selectedItem = ref(null);
const onItemClick = (item) => {
  if (selectedItem.value === item) {
    selectedItem.value = null;
    return;
  }
  selectedItem.value = item;
};
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
