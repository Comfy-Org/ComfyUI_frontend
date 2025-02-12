<template>
  <div class="absolute top-0 left-0 w-auto max-w-full">
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
