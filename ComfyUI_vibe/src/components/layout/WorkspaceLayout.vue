<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import WorkspaceSidebar from './WorkspaceSidebar.vue'

const route = useRoute()

const workspaceId = computed(() => route.params.workspaceId as string)
</script>

<template>
  <div class="flex h-screen bg-white dark:bg-zinc-950">
    <WorkspaceSidebar :workspace-id="workspaceId" />
    <main class="flex-1 overflow-auto bg-zinc-50/50 dark:bg-zinc-900/50">
      <slot />
    </main>
  </div>
</template>
