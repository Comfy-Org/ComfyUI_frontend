<script setup lang="ts">
import type { TeamModel } from '@/data/sidebarMockData'

defineProps<{
  models: TeamModel[]
  viewMode: 'list' | 'grid'
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

function getModelTypeLabel(type: TeamModel['type']): string {
  switch (type) {
    case 'checkpoint': return 'Checkpoint'
    case 'lora': return 'LoRA'
    case 'embedding': return 'Embedding'
    case 'controlnet': return 'ControlNet'
    default: return type
  }
}
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
      <i class="pi pi-box text-xs text-green-400" />
      <span class="flex-1 text-xs font-medium text-zinc-300">Team Models</span>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
        {{ models.length }}
      </span>
    </button>

    <!-- Items -->
    <div v-if="expanded" class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2">
      <div
        v-for="model in models"
        :key="model.id"
        class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
        draggable="true"
      >
        <i class="pi pi-file text-[10px] text-zinc-600 group-hover:text-zinc-400" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">{{ model.name }}</span>
            <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
              {{ getModelTypeLabel(model.type) }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{{ model.size }}</span>
            <span>{{ model.downloads }} downloads</span>
          </div>
        </div>
        <i class="pi pi-download text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  </template>

  <!-- Grid View -->
  <template v-else>
    <div class="mb-1.5 flex items-center gap-2 px-1">
      <i class="pi pi-box text-xs text-green-400" />
      <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Team Models</span>
    </div>
    <div class="grid grid-cols-2 gap-1.5">
      <div
        v-for="model in models"
        :key="model.id"
        class="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-2 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
        draggable="true"
      >
        <div class="mb-1 flex items-center justify-between">
          <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
            {{ getModelTypeLabel(model.type) }}
          </span>
          <span class="text-[9px] text-zinc-600">{{ model.size }}</span>
        </div>
        <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
          {{ model.name }}
        </div>
        <div class="mt-0.5 truncate text-[10px] text-zinc-600">
          {{ model.downloads }} downloads
        </div>
      </div>
    </div>
  </template>
</template>
