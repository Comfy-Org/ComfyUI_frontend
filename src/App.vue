<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <div v-else>
    <NodeSearchboxPopover v-if="nodeSearchEnabled" />
    <teleport to="#graph-canvas-container">
      <LiteGraphCanvasSplitterOverlay>
        <template #side-bar-panel>
          <SideToolBar />
        </template>
      </LiteGraphCanvasSplitterOverlay>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, ref, watch } from "vue";
import NodeSearchboxPopover from "@/components/NodeSearchBoxPopover.vue";
import SideToolBar from "@/components/sidebar/SideToolBar.vue";
import LiteGraphCanvasSplitterOverlay from "@/components/LiteGraphCanvasSplitterOverlay.vue";
import QueueSideBarTab from "@/components/sidebar/tabs/QueueSideBarTab.vue";
import ProgressSpinner from "primevue/progressspinner";
import { app } from "./scripts/app";
import { useSettingStore } from "./stores/settingStore";
import { useNodeDefStore } from "./stores/nodeDefStore";
import { ExtensionManagerImpl } from "./scripts/extensionManager";
import { useI18n } from "vue-i18n";

const isLoading = ref(true);
const nodeSearchEnabled = computed<boolean>(
  () => useSettingStore().get("Comfy.NodeSearchBoxImpl") === "default"
);
const theme = computed<string>(() =>
  useSettingStore().get("Comfy.ColorPalette")
);
watch(
  theme,
  (newTheme) => {
    const DARK_THEME_CLASS = "dark-theme";
    const isDarkTheme = newTheme !== "light";
    if (isDarkTheme) {
      document.body.classList.add(DARK_THEME_CLASS);
    } else {
      document.body.classList.remove(DARK_THEME_CLASS);
    }
  },
  { immediate: true }
);

const { t } = useI18n();
const init = () => {
  useNodeDefStore().addNodeDefs(Object.values(app.nodeDefs));
  useSettingStore().addSettings(app.ui.settings);
  app.vueAppReady = true;
  // Late init as extension manager needs to access pinia store.
  app.extensionManager = new ExtensionManagerImpl();
  app.extensionManager.registerSidebarTab({
    id: "queue",
    icon: "pi pi-history",
    title: t("sideToolBar.queue"),
    tooltip: t("sideToolBar.queue"),
    component: markRaw(QueueSideBarTab),
    type: "vue",
  });
};

onMounted(() => {
  try {
    init();
  } catch (e) {
    console.error("Failed to init Vue app", e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
