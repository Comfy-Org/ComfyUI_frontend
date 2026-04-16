<script setup lang="ts">
/**
 * InputsCell — single bento cell that hosts the full list of selected
 * input widgets from the current workflow.
 *
 * Phase 1: wraps the existing AppModeWidgetList component so widget
 * rendering, editing, drop-zones, height persistence, and the action
 * menu all work without reimplementing. Phase 2 will break each input
 * into its own bento cell once per-widget layout editing is wired.
 */
import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
</script>

<template>
  <div class="inputs-cell">
    <AppModeWidgetList />
  </div>
</template>

<style scoped>
.inputs-cell {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow-y: auto;
  padding: 8px 4px;
}
</style>
