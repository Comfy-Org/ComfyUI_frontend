<script setup lang="ts">
import type { TeamModel } from '@/data/sidebarMockData'
import { LibraryGridCard } from '@/components/common/sidebar'

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

function getModelBadgeClass(type: TeamModel['type']): string {
  switch (type) {
    case 'checkpoint': return 'bg-purple-500/30 text-purple-300'
    case 'lora': return 'bg-green-500/30 text-green-300'
    case 'embedding': return 'bg-amber-500/30 text-amber-300'
    case 'controlnet': return 'bg-cyan-500/30 text-cyan-300'
    default: return 'bg-zinc-700 text-zinc-400'
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
    <div class="mb-2 flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <i class="pi pi-box text-xs text-green-400" />
        <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Models</span>
      </div>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
        {{ models.length }}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <LibraryGridCard
        v-for="model in models"
        :key="model.id"
        :title="model.name"
        :subtitle="`${model.size} · ${model.downloads} downloads`"
        :thumbnail="model.thumbnail"
        icon="pi pi-box"
        icon-class="text-green-400"
        :badge="getModelTypeLabel(model.type)"
        :badge-class="getModelBadgeClass(model.type)"
      />
    </div>
  </template>
</template>
