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
import { ColorPaletteLoadedEvent } from "./types/colorPalette";
import { LiteGraphNodeSearchSettingEvent } from "./scripts/ui";
import { app } from "./scripts/app";

const isLoading = ref(true);
const nodeSearchEnabled = ref(false);
const nodeSearchService = ref<NodeSearchService>();

const updateTheme = (e: ColorPaletteLoadedEvent) => {
  const DARK_THEME_CLASS = "dark-theme";
  const isDarkTheme = e.detail.id !== "light";

  if (isDarkTheme) {
    document.body.classList.add(DARK_THEME_CLASS);
  } else {
    document.body.classList.remove(DARK_THEME_CLASS);
  }
};

const updateNodeSearchSetting = (e: LiteGraphNodeSearchSettingEvent) => {
  nodeSearchEnabled.value = !e.detail;
};

const init = async () => {
  const nodeDefs = Object.values(app.nodeDefs);
  nodeSearchService.value = new NodeSearchService([
    ...nodeDefs,
    ...SYSTEM_NODE_DEFS,
  ]);

  document.addEventListener("comfy:setting:color-palette-loaded", updateTheme);
  document.addEventListener(
    "comfy:setting:litegraph-node-search",
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
  document.removeEventListener(
    "comfy:setting:color-palette-loaded",
    updateTheme
  );
  document.removeEventListener(
    "comfy:setting:litegraph-node-search",
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
