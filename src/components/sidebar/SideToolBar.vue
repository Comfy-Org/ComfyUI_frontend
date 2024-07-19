<template>
  <nav class="side-tool-bar-container">
    <SideBarIcon
      v-for="item in items"
      :icon="item.icon"
      :selected="item === selectedItem"
      @click="onItemClick(item)"
    />
    <div class="side-tool-bar-end">
      <SideBarThemeToggleIcon />
      <SideBarIcon icon="pi pi-cog" />
    </div>
  </nav>
</template>

<script setup lang="ts">
import SideBarIcon from "./SideBarIcon.vue";
import SideBarThemeToggleIcon from "./SideBarThemeToggleIcon.vue";
import { ref } from "vue";

const items = ref([{ icon: "pi pi-plus" }, { icon: "pi pi-search" }]);
const selectedItem = ref(null);
const onItemClick = (item) => {
  if (selectedItem.value === item) {
    selectedItem.value = null;
    return;
  }
  selectedItem.value = item;
};
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

  position: fixed;
  /* Fix the position relative to the viewport */
  left: 0;
  /* Align to the left side of the viewport */
  top: 0;
  /* Align to the top of the viewport */
  width: var(--sidebar-width);
  height: 100vh;
  /* Set the height to cover the full viewport height */

  background-color: var(--comfy-menu-bg);
  color: var(--fg-color);
}

.side-tool-bar-end {
  align-self: flex-end;
  margin-top: auto;
}
</style>
