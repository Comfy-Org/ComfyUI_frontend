<template>
  <teleport to=".comfyui-body-left">
    <nav class="side-tool-bar-container">
      <SideBarIcon
        v-for="item in items"
        :icon="item.icon"
        :tooltip="item.tooltip"
        :selected="item === selectedItem"
        @click="onItemClick(item)"
      />
      <div class="side-tool-bar-end">
        <SideBarThemeToggleIcon />
        <SideBarSettingsToggleIcon />
      </div>
    </nav>
  </teleport>
  <component :is="selectedItem?.component" />
</template>

<script setup lang="ts">
import SideBarIcon from "./SideBarIcon.vue";
import SideBarThemeToggleIcon from "./SideBarThemeToggleIcon.vue";
import SideBarSettingsToggleIcon from "./SideBarSettingsToggleIcon.vue";
import NodeDetailSideBarItem from "./items/NodeDetailSideBarItem.vue";
import QueueSideBarItem from "./items/QueueSideBarItem.vue";
import { computed, markRaw, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingStore } from "@/stores/settingStore";

const { t } = useI18n();
const items = ref([
  // { icon: "pi pi-map", component: markRaw(NodeDetailSideBarItem) },
  {
    icon: "pi pi-history",
    tooltip: t("sideToolBar.queue"),
    component: markRaw(QueueSideBarItem),
  },
]);
const selectedItem = ref(null);
const onItemClick = (item) => {
  if (selectedItem.value === item) {
    selectedItem.value = null;
    return;
  }
  selectedItem.value = item;
};

const emit = defineEmits(["change"]);
watch(selectedItem, (newVal) => {
  emit("change", newVal !== null);
});

const betaMenuEnabled = computed(
  () => useSettingStore().get("Comfy.UseNewMenu") !== "Disabled"
);
watch(betaMenuEnabled, (newValue) => {
  if (!newValue) {
    selectedItem.value = null;
  }
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
