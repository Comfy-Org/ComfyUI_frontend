<script setup lang="ts">
/**
 * ModeToggleCell — wraps the existing WorkflowActionsDropdown that
 * provides the App ↔ Graph mode toggle.
 *
 * The dropdown component renders its icon + label + chevron inside a
 * rounded-pill wrapper. Inside a layout cell we don't want that pill —
 * the cell IS the button background. The :deep() overrides below
 * neutralize the wrapper's own rounding, background, and fixed sizing
 * so the cell's subtle fill shows through and the interactive bits
 * (mode-toggle icon button + dropdown trigger button) sit inside it.
 */
import WorkflowActionsDropdown from '@/components/common/WorkflowActionsDropdown.vue'
</script>

<template>
  <div class="mode-toggle-cell">
    <WorkflowActionsDropdown source="app_mode_toolbar" />
  </div>
</template>

<style scoped>
.mode-toggle-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
}

/* Neutralize the dropdown's outer pill so the layout cell itself
   provides the button surface. The inner two Buttons keep their
   natural sizing (icon button has m-1 inset; "App ▾" trigger has
   h-10), matching the graph-mode version's spacing inside the pill. */
.mode-toggle-cell :deep(.bg-secondary-background) {
  background: transparent !important;
  border-radius: 0 !important;
  width: 100%;
  padding: 0 !important;
}

/* Match the 20px icon size of the Builder / Share / Feedback chrome.
   Targets the leading App/Graph icon (m-1 is the icon-button wrapper)
   without touching the dropdown chevron. */
.mode-toggle-cell :deep(button.m-1 > i) {
  width: 20px;
  height: 20px;
}
</style>
