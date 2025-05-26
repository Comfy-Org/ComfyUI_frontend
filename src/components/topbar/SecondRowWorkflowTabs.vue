<template>
  <div class="w-auto max-w-full">
    <WorkflowTabs />
  </div>
</template>

<script setup lang="ts">
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
</script>

<style scoped>
:deep(.workflow-tabs) {
  background-color: var(--comfy-menu-bg);
}
</style>
