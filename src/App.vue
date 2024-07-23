<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <div v-else>
    <NodeSearchboxPopover v-if="nodeSearchEnabled" />
    <teleport to="#graph-canvas-container">
      <LiteGraphCanvasSplitterOverlay>
        <template #side-bar-panel="{ setPanelVisible }">
          <SideToolBar @change="setPanelVisible($event)" />
        </template>
      </LiteGraphCanvasSplitterOverlay>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from "vue";
import NodeSearchboxPopover from "@/components/NodeSearchBoxPopover.vue";
import SideToolBar from "@/components/sidebar/SideToolBar.vue";
import LiteGraphCanvasSplitterOverlay from "@/components/LiteGraphCanvasSplitterOverlay.vue";
import ProgressSpinner from "primevue/progressspinner";
import {
  NodeSearchService,
  SYSTEM_NODE_DEFS,
} from "./services/nodeSearchService";
import { app } from "./scripts/app";

const isLoading = ref(true);
const nodeSearchEnabled = ref(false);
const nodeSearchService = ref<NodeSearchService>();

const updateTheme = (e) => {
  const DARK_THEME_CLASS = "dark-theme";
  const isDarkTheme = e.detail.value !== "light";

  if (isDarkTheme) {
    document.body.classList.add(DARK_THEME_CLASS);
  } else {
    document.body.classList.remove(DARK_THEME_CLASS);
  }
};

const updateNodeSearchSetting = (e) => {
  const settingValue = e.detail.value || "default";
  nodeSearchEnabled.value = settingValue === "default";
};

const init = async () => {
  const nodeDefs = Object.values(app.nodeDefs);
  nodeSearchService.value = new NodeSearchService([
    ...nodeDefs,
    ...SYSTEM_NODE_DEFS,
  ]);

  app.ui.settings.addEventListener("Comfy.ColorPalette.change", updateTheme);
  app.ui.settings.addEventListener(
    "Comfy.NodeSearchBoxImpl.change",
    updateNodeSearchSetting
  );
  app.ui.settings.refreshSetting("Comfy.NodeSearchBoxImpl");
  app.ui.settings.refreshSetting("Comfy.ColorPalette");
};

onMounted(async () => {
  try {
    await init();
  } catch (e) {
    console.error("Failed to init Vue app", e);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  app.ui.settings.removeEventListener("Comfy.ColorPalette.change", updateTheme);
  app.ui.settings.removeEventListener(
    "Comfy.NodeSearchBoxImpl.change",
    updateNodeSearchSetting
  );
});

provide("nodeSearchService", nodeSearchService);
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
