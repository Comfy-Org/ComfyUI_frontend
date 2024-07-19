<template>
  <SideBarIcon :icon="icon" @click="toggleTheme" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SideBarIcon from "./SideBarIcon.vue";
import { app } from "@/scripts/app";

const isDarkMode = ref(false);
const icon = computed(() => (isDarkMode.value ? "pi pi-sun" : "pi pi-moon"));
const themeId = computed(() => (isDarkMode.value ? "dark" : "light"));
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};

watch(themeId, (newThemeId) => {
  app.ui.settings.setSettingValue("Comfy.ColorPalette", newThemeId);
});
</script>
