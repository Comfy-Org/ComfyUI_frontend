<script setup lang="ts">
import { WORKFLOWS_DATA } from '@/data/sidebarMockData'

defineProps<{
  viewMode: 'list' | 'grid'
}>()

const mockWorkflows = WORKFLOWS_DATA
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="workflow in mockWorkflows"
      :key="workflow.name"
      class="group cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <!-- Thumbnail (16:9) -->
      <div class="relative aspect-video bg-zinc-950">
        <div
          class="absolute inset-0 flex items-center justify-center"
          :class="{
            'bg-gradient-to-br from-blue-900/30 to-purple-900/30': workflow.thumbnail === 'txt2img',
            'bg-gradient-to-br from-green-900/30 to-teal-900/30': workflow.thumbnail === 'img2img',
            'bg-gradient-to-br from-orange-900/30 to-red-900/30': workflow.thumbnail === 'controlnet',
            'bg-gradient-to-br from-violet-900/30 to-pink-900/30': workflow.thumbnail === 'sdxl',
            'bg-gradient-to-br from-cyan-900/30 to-blue-900/30': workflow.thumbnail === 'inpaint',
          }"
        >
          <i class="pi pi-sitemap text-2xl text-zinc-700" />
        </div>
        <button
          v-tooltip.left="{ value: 'Share', showDelay: 50 }"
          class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded bg-zinc-800/90 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          <i class="pi pi-share-alt text-[10px]" />
        </button>
        <div class="absolute bottom-1.5 left-1.5 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {{ workflow.nodes }} nodes
        </div>
      </div>
      <!-- Info -->
      <div class="flex items-center justify-between px-2.5 py-2">
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium text-zinc-300">{{ workflow.name }}</div>
          <div class="mt-0.5 text-[10px] text-zinc-500">{{ workflow.date }}</div>
        </div>
        <button
          v-tooltip.left="{ value: 'Add to Canvas', showDelay: 50 }"
          class="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600 text-white transition-all hover:bg-blue-500"
        >
          <i class="pi pi-plus text-[10px]" />
        </button>
      </div>
    </div>
  </div>
</template>
