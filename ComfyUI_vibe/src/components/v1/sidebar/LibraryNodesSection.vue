<script setup lang="ts">
import type { NodePack } from '@/data/sidebarMockData'
import { LibraryGridCard } from '@/components/common/sidebar'

defineProps<{
  packs: NodePack[]
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
      <i class="pi pi-code text-xs text-purple-400" />
      <span class="flex-1 text-xs font-medium text-zinc-300">Custom Nodes</span>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
        {{ packs.length }}
      </span>
    </button>

    <!-- Items -->
    <div v-if="expanded" class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2">
      <div
        v-for="pack in packs"
        :key="pack.id"
        class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
      >
        <i class="pi pi-circle-fill text-[5px] text-zinc-600 group-hover:text-zinc-400" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">{{ pack.name }}</span>
            <span class="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
              v{{ pack.version }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{{ pack.nodes }} nodes</span>
            <span>{{ pack.author }}</span>
          </div>
        </div>
        <button
          :class="[
            'flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-medium transition-all',
            pack.installed
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          ]"
        >
          <i :class="pack.installed ? 'pi pi-check' : 'pi pi-download'" class="text-[9px]" />
          {{ pack.installed ? 'Installed' : 'Install' }}
        </button>
      </div>
    </div>
  </template>

  <!-- Grid View -->
  <template v-else>
    <div class="mb-2 flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <i class="pi pi-code text-xs text-purple-400" />
        <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Nodepacks</span>
      </div>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
        {{ packs.length }}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <LibraryGridCard
        v-for="pack in packs"
        :key="pack.id"
        :title="pack.name"
        :subtitle="`${pack.nodes} nodes · v${pack.version}`"
        :thumbnail="pack.thumbnail"
        icon="pi pi-code"
        icon-class="text-purple-400"
        :badge="pack.installed ? 'Installed' : 'Available'"
        :badge-class="pack.installed ? 'bg-green-500/30 text-green-300' : 'bg-zinc-700 text-zinc-400'"
      />
    </div>
  </template>
</template>
