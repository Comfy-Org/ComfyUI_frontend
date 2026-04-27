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
    class="mode-toggle-cell flex size-full items-center [&_.bg-layout-cell]:w-full [&_.bg-layout-cell]:rounded-none! [&_.bg-layout-cell]:bg-transparent! [&_.bg-layout-cell]:p-0! [&_button.m-1>i]:size-5"
  >
    <WorkflowActionsDropdown source="app_mode_toolbar" />
  </div>
</template>

<!--
  WorkflowActionsDropdown wraps its mode-toggle-icon Button + the
  "App / Graph" dropdown trigger in an `inline-flex` container with
  no explicit horizontal-distribution rule. Inside our chrome cell
  (a fixed-width box) the children clustered with awkward spacing —
  tight side margins, oversized middle gap. Force the inner wrapper
  to fill the cell and use `space-evenly` so left-margin =
  middle-gap = right-margin, matching the BatchCountCell treatment.
  Also flatten the wrapper's own rounded-lg + secondary-background
  so the chrome cell's surface owns the visual bounds.
-->
<style scoped>
.mode-toggle-cell :deep(.bg-secondary-background) {
  display: flex;
  width: 100%;
  justify-content: space-around;
  background-color: transparent;
  border-radius: 0;
}
</style>
