<template>
  <SideBarIcon
    :icon="icon"
    @click="toggleTheme"
    :tooltip="$t('sideToolBar.themeToggle')"
    class="comfy-vue-theme-toggle"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SideBarIcon from "./SideBarIcon.vue";
import { useSettingStore } from "@/stores/settingStore";

const previousDarkTheme = ref("dark");
const currentTheme = computed(() =>
  useSettingStore().get("Comfy.ColorPalette", "dark")
);
const isDarkMode = computed(() => currentTheme.value !== "light");
const icon = computed(() => (isDarkMode.value ? "pi pi-moon" : "pi pi-sun"));

const toggleTheme = () => {
  if (isDarkMode.value) {
    previousDarkTheme.value = currentTheme.value;
    useSettingStore().set("Comfy.ColorPalette", "light");
  } else {
    useSettingStore().set("Comfy.ColorPalette", previousDarkTheme.value);
  }
};
</script>
