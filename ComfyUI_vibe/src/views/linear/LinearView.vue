<script setup lang="ts">
import LinearIconSidebar from '@/components/linear/LinearIconSidebar.vue'
import LinearCreationPanel from '@/components/linear/LinearCreationPanel.vue'
import LinearHistoryPanel from '@/components/linear/LinearHistoryPanel.vue'
import LinearTopBar from '@/components/linear/LinearTopBar.vue'
</script>

<template>
  <div class="linear-view flex h-screen flex-col bg-zinc-950">
    <!-- Top Bar with Logo, Home, Session Name, Credits -->
    <LinearTopBar />

    <!-- Main Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left Icon Sidebar (Chat, Tool, Apps, Workflow) -->
      <LinearIconSidebar />

      <!-- Left Creation Panel (prompt, upload, settings, generate) -->
      <LinearCreationPanel />

      <!-- Right Main Area (queue/history) -->
      <LinearHistoryPanel />
    </div>
  </div>
</template>

<style scoped>
.linear-view {
  font-family: var(--font-sans, system-ui);
}
</style>
