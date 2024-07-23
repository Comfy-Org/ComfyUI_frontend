<template>
  <SideBarIcon :icon="icon" @click="toggleTheme" tooltip="Toggle Theme" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import SideBarIcon from "./SideBarIcon.vue";
import { app } from "@/scripts/app";

const isDarkMode = ref(false);
const icon = computed(() => (isDarkMode.value ? "pi pi-moon" : "pi pi-sun"));
const themeId = computed(() => (isDarkMode.value ? "dark" : "light"));
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};

watch(themeId, (newThemeId) => {
  app.ui.settings.setSettingValue("Comfy.ColorPalette", newThemeId);
});

const updateTheme = (e) => {
  isDarkMode.value = e.detail.value !== "light";
};

onMounted(() => {
  app.ui.settings.addEventListener("Comfy.ColorPalette.change", updateTheme);
  app.ui.settings.refreshSetting("Comfy.ColorPalette");
});

onUnmounted(() => {
  app.ui.settings.removeEventListener("Comfy.ColorPalette.change", updateTheme);
});
</script>
