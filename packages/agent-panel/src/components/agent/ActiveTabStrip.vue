<script setup lang="ts">
import type { ActiveTab } from '@/composables/agent/useCanvasContext'

// Shows which workflow the agent is acting on. Hidden when there is no active tab.
const { tab } = defineProps<{ tab: ActiveTab | null }>()
</script>

<template>
  <div
    v-if="tab"
    class="border-agent-border text-agent-fg-muted flex items-center gap-1.5 border-b px-4 py-1.5 text-xs"
  >
    <span class="icon-[lucide--panels-top-left] size-3.5" />
    <span class="truncate">{{ tab.name }}</span>
  </div>
</template>
