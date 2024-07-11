<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <div v-else>
    <NodeSearchboxPopover v-if="nodeSearchEnabled" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from "vue";
import NodeSearchboxPopover from "@/components/NodeSearchBoxPopover.vue";
import ProgressSpinner from "primevue/progressspinner";
import { api } from "@/scripts/api";
import { NodeSearchService } from "./services/nodeSearchService";
import { ColorPaletteLoadedEvent } from "./types/colorPalette";
import { LiteGraphNodeSearchSettingEvent } from "./scripts/ui";

const isLoading = ref(true);
const nodeSearchEnabled = ref(true);
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
  // nodeSearchEnabled.value = !e.detail;
};

onMounted(async () => {
  const nodeDefs = Object.values(await api.getNodeDefs());
  nodeSearchService.value = new NodeSearchService(nodeDefs);
  isLoading.value = false;

  document.addEventListener("comfy:setting:color-palette-loaded", updateTheme);
  document.addEventListener(
    "comfy:setting:litegraph-node-search",
    updateNodeSearchSetting
  );
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
