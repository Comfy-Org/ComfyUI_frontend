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
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import NodeSearchboxPopover from "@/components/NodeSearchBoxPopover.vue";
import SideToolBar from "@/components/sidebar/SideToolBar.vue";
import LiteGraphCanvasSplitterOverlay from "@/components/LiteGraphCanvasSplitterOverlay.vue";
import ProgressSpinner from "primevue/progressspinner";
import { NodeSearchService } from "./services/nodeSearchService";
import { app } from "./scripts/app";
import { useSettingStore } from "./stores/settingStore";
import { useNodeDefStore } from "./stores/nodeDefStore";

const isLoading = ref(true);
const nodeSearchService = computed(
  () => new NodeSearchService(useNodeDefStore().nodeDefs)
);
const nodeSearchEnabled = computed<boolean>(
  () => useSettingStore().get("Comfy.NodeSearchBoxImpl") === "default"
);
const theme = computed<string>(() =>
  useSettingStore().get("Comfy.ColorPalette")
);
watch(theme, (newTheme) => {
  const DARK_THEME_CLASS = "dark-theme";
  const isDarkTheme = newTheme !== "light";
  if (isDarkTheme) {
    document.body.classList.add(DARK_THEME_CLASS);
  } else {
    document.body.classList.remove(DARK_THEME_CLASS);
  }
});

const init = async () => {
  useNodeDefStore().addNodeDefs(Object.values(app.nodeDefs));
  useSettingStore().addSettings(app.ui.settings);
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

provide("nodeSearchService", nodeSearchService);
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
