<template>
  <SideBarIcon :icon="icon" @click="toggleTheme" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SideBarIcon from "./SideBarIcon.vue";

const isDarkMode = ref(false);
const icon = computed(() => (isDarkMode.value ? "pi pi-sun" : "pi pi-moon"));
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};
</script>
