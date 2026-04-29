<script setup lang="ts">
import WorkflowActionsDropdown from '@/components/common/WorkflowActionsDropdown.vue'
</script>

<template>
  <div
    class="mode-toggle-cell flex size-full items-center [&_button.m-1>i]:size-5"
  >
    <WorkflowActionsDropdown source="app_mode_toolbar" />
  </div>
</template>

<style scoped>
/* Reset WorkflowActionsDropdown's pill chrome so the cell surface
   owns the visuals. */
.mode-toggle-cell :deep(.bg-secondary-background) {
  display: flex;
  width: 100%;
  justify-content: space-around;
  background-color: transparent;
  border-radius: 0;
}
.mode-toggle-cell :deep(.bg-layout-cell) {
  width: 100%;
  background-color: transparent !important;
  border-radius: 0 !important;
  padding: 0 !important;
}
</style>
