<script setup lang="ts">
import type { SharedWorkflow } from '@/data/sidebarMockData'
import { LibraryGridCard } from '@/components/common/sidebar'

defineProps<{
  workflows: SharedWorkflow[]
  viewMode: 'list' | 'grid'
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <!-- List View -->
  <template v-if="viewMode === 'list'">
    <!-- Category Header -->
    <button
      class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
      @click="emit('toggle')"
    >
      <i
        class="text-[10px] text-zinc-500 transition-transform"
        :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
      />
      <i class="pi pi-sitemap text-xs text-blue-400" />
      <span class="flex-1 text-xs font-medium text-zinc-300">Shared Workflows</span>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
        {{ workflows.length }}
      </span>
    </button>

    <!-- Items -->
    <div v-if="expanded" class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2">
      <div
        v-for="workflow in workflows"
        :key="workflow.id"
        class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
        draggable="true"
      >
        <i class="pi pi-circle-fill text-[5px] text-zinc-600 group-hover:text-zinc-400" />
        <i v-if="workflow.starred" class="pi pi-star-fill text-[10px] text-amber-400" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
            {{ workflow.name }}
          </div>
          <div class="flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{{ workflow.nodes }} nodes</span>
            <span>{{ workflow.updatedAt }}</span>
          </div>
        </div>
        <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  </template>

  <!-- Grid View -->
  <template v-else>
    <div class="mb-2 flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <i class="pi pi-sitemap text-xs text-blue-400" />
        <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Workflows</span>
      </div>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
        {{ workflows.length }}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <LibraryGridCard
        v-for="workflow in workflows"
        :key="workflow.id"
        :title="workflow.name"
        :subtitle="`${workflow.nodes} nodes · ${workflow.updatedAt}`"
        :thumbnail="workflow.thumbnail"
        icon="pi pi-sitemap"
        icon-class="text-blue-400"
        :badge="workflow.category"
        badge-class="bg-blue-500/30 text-blue-300"
        :starred="workflow.starred"
      />
    </div>
  </template>
</template>
