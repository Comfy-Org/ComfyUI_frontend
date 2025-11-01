<template>
  <div class="flex h-full w-auto max-w-full items-center">
    <WorkflowTabs />
    <TopbarBadges />
  </div>
</template>

<script setup lang="ts">
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
</script>

<style scoped>
:deep(.workflow-tabs) {
  background-color: var(--comfy-menu-bg);
}
</style>
