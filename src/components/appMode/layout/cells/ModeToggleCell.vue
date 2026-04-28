<script setup lang="ts">
/**
 * ModeToggleCell — wraps WorkflowActionsDropdown (App ↔ Graph
 * toggle) for the chrome cell grid. The arbitrary variants on the
 * outer div neutralize the dropdown's own pill background and
 * sizing so the cell's surface owns the visual bounds.
 */
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
/* Adapt WorkflowActionsDropdown's pill-shaped wrapper to the cell:
   space-around fills the cell width (matches BatchCountCell), and
   the bg + radius reset lets the cell surface own the visuals. */
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
