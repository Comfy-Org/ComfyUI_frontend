<script setup lang="ts">
/**
 * ModeToggleCell — wraps the existing WorkflowActionsDropdown that
 * provides the App ↔ Graph mode toggle.
 *
 * The dropdown component renders its icon + label + chevron inside a
 * rounded-pill wrapper. Inside a layout cell we don't want that pill —
 * the cell IS the button background. The arbitrary variants below
 * neutralize the wrapper's own rounding, background, and fixed sizing
 * so the cell's subtle fill shows through and the interactive bits
 * (mode-toggle icon button + dropdown trigger button) sit inside it.
 *
 * The [&_button.m-1>i]:size-5 rule matches the 20px icon scale used by
 * the Builder / Share / Feedback IconCells. The m-1 selector targets
 * the inner WorkflowActionsDropdown icon-button wrapper without
 * touching the dropdown chevron.
 */
import WorkflowActionsDropdown from '@/components/common/WorkflowActionsDropdown.vue'
</script>

<template>
  <div
    class="flex size-full items-center [&_.bg-layout-cell]:w-full [&_.bg-layout-cell]:rounded-none! [&_.bg-layout-cell]:bg-transparent! [&_.bg-layout-cell]:p-0! [&_button.m-1>i]:size-5"
  >
    <WorkflowActionsDropdown source="app_mode_toolbar" />
  </div>
</template>
