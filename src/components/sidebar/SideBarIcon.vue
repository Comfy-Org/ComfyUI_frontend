<template>
  <Button
    :icon="props.icon"
    text
    :pt="{
      root: `side-bar-button ${
        props.selected
          ? 'p-button-primary side-bar-button-selected'
          : 'p-button-secondary'
      }`,
      icon: 'side-bar-button-icon',
    }"
    @click="emit('click', $event)"
  />
</template>

<script setup lang="ts">
import Button from "primevue/button";

const props = defineProps({
  icon: String,
  selected: Boolean,
});

const emit = defineEmits(["click"]);
</script>

<style>
.p-button-icon.side-bar-button-icon {
  font-size: var(--sidebar-icon-size) !important;
}

.side-bar-button-selected .p-button-icon.side-bar-button-icon {
  font-size: var(--sidebar-icon-size) !important;
  font-weight: bold;
}
</style>

<style scoped>
.side-bar-button {
  width: var(--sidebar-width);
  height: var(--sidebar-width);
  border-radius: 0;
}

.side-bar-button.side-bar-button-selected,
.side-bar-button.side-bar-button-selected:hover {
  border-left: 4px solid var(--p-button-text-primary-color);
}
</style>
