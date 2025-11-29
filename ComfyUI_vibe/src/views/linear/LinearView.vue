<script setup lang="ts">
import { ref } from 'vue'
import LinearIconSidebar from '@/components/linear/LinearIconSidebar.vue'
import LinearCreationPanel from '@/components/linear/LinearCreationPanel.vue'
import LinearHistoryPanel from '@/components/linear/LinearHistoryPanel.vue'

const sessionName = ref('Untitled session')
const credits = ref(4625)
</script>

<template>
  <div class="linear-view flex h-screen bg-zinc-950">
    <!-- Left Icon Sidebar (Chat, Tool, Apps, Workflow) -->
    <LinearIconSidebar />

    <!-- Left Creation Panel (prompt, upload, settings, generate) -->
    <LinearCreationPanel />

    <!-- Right Main Area (queue/history) -->
    <div class="flex flex-1 flex-col">
      <!-- Top Bar -->
      <header class="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div />

        <!-- Center: Session Name -->
        <div class="flex items-center gap-1">
          <span class="text-sm text-zinc-300">{{ sessionName }}</span>
          <button class="p-1 text-zinc-500 transition-colors hover:text-zinc-300">
            <i class="pi pi-ellipsis-h text-xs" />
          </button>
        </div>

        <!-- Right: Credits + Upgrade -->
        <div class="flex items-center gap-3">
          <button class="text-zinc-500 transition-colors hover:text-zinc-300">
            <i class="pi pi-question-circle text-sm" />
          </button>
          <button class="text-zinc-500 transition-colors hover:text-zinc-300">
            <i class="pi pi-external-link text-sm" />
          </button>
          <span class="text-xs text-zinc-400">{{ credits.toLocaleString() }} credits</span>
          <button class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
            Upgrade
          </button>
        </div>
      </header>

      <!-- Main Content Area -->
      <LinearHistoryPanel />
    </div>
  </div>
</template>

<style scoped>
.linear-view {
  font-family: var(--font-sans, system-ui);
}
</style>
