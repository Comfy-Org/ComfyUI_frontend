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
    class="mode-toggle-cell flex size-full items-center [&_.bg-layout-cell]:w-full [&_.bg-layout-cell]:rounded-none! [&_.bg-layout-cell]:bg-transparent! [&_.bg-layout-cell]:p-0! [&_button.m-1>i]:size-5"
  >
    <WorkflowActionsDropdown source="app_mode_toolbar" />
  </div>
</template>

<style scoped>
/* Inside the cell the dropdown's children clustered with awkward
   spacing — `space-around` fills the cell width and balances margins,
   matching BatchCountCell's treatment. Also flatten the wrapper's
   own bg + radius so the cell surface owns visuals. */
.mode-toggle-cell :deep(.bg-secondary-background) {
  display: flex;
  width: 100%;
  justify-content: space-around;
  background-color: transparent;
  border-radius: 0;
}
</style>
