<script setup lang="ts">
export interface ActiveTab {
  path: string
  name: string
  modified?: boolean
}

const { tab } = defineProps<{ tab: ActiveTab | null }>()
</script>

<template>
  <span
    v-if="tab"
    class="text-agent-fg-muted flex min-w-0 items-center gap-1 text-xs"
  >
    <span class="icon-[lucide--panels-top-left] size-3.5 shrink-0" />
    <span class="truncate">{{ tab.name }}</span>
  </span>
</template>
