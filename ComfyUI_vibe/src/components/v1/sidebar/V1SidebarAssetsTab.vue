<script setup lang="ts">
import { ASSETS_DATA } from '@/data/sidebarMockData'

defineProps<{
  viewMode: 'list' | 'grid'
}>()

const mockAssets = ASSETS_DATA
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="asset in mockAssets"
      :key="asset.name"
      class="cursor-pointer rounded px-2 py-1.5 text-xs transition-colors hover:bg-zinc-800"
    >
      <i class="pi pi-image mr-2 text-zinc-500" />
      <span class="text-zinc-300">{{ asset.name }}</span>
    </div>
  </div>
</template>
