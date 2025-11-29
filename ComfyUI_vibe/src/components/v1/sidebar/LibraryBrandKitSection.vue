<script setup lang="ts">
import type { BrandAsset } from '@/data/sidebarMockData'

defineProps<{
  assets: BrandAsset[]
  viewMode: 'list' | 'grid'
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

function getAssetIcon(type: BrandAsset['type']): string {
  switch (type) {
    case 'logo': return 'pi pi-image'
    case 'color': return 'pi pi-circle-fill'
    case 'font': return 'pi pi-align-left'
    case 'template': return 'pi pi-clone'
    case 'guideline': return 'pi pi-book'
    default: return 'pi pi-file'
  }
}

function getAssetTypeLabel(type: BrandAsset['type']): string {
  switch (type) {
    case 'logo': return 'Logo'
    case 'font': return 'Font'
    case 'template': return 'Template'
    case 'guideline': return 'Guide'
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
      <i class="pi pi-palette text-xs text-amber-400" />
      <span class="flex-1 text-xs font-medium text-zinc-300">Brand Kit</span>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
        {{ assets.filter(a => a.type !== 'color').length }}
      </span>
    </button>

    <!-- Items -->
    <div v-if="expanded" class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2">
      <div
        v-for="asset in assets.filter(a => a.type !== 'color')"
        :key="asset.id"
        class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-zinc-800"
      >
        <i class="pi pi-circle-fill text-[5px] text-zinc-600 group-hover:text-zinc-400" />
        <i :class="[getAssetIcon(asset.type), 'text-[10px] text-zinc-500']" />
        <span class="flex-1 truncate text-xs text-zinc-400 group-hover:text-zinc-200">{{ asset.name }}</span>
        <i class="pi pi-download text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  </template>

  <!-- Grid View -->
  <template v-else>
    <div class="mb-2 flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <i class="pi pi-palette text-xs text-amber-400" />
        <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Brand Kit</span>
      </div>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
        {{ assets.filter(a => a.type !== 'color').length }}
      </span>
    </div>

    <!-- Assets Grid -->
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="asset in assets.filter(a => a.type !== 'color')"
        :key="asset.id"
        class="group cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition-all hover:border-zinc-600 hover:bg-zinc-800/80"
      >
        <!-- Icon Thumbnail -->
        <div class="relative flex aspect-[4/3] items-center justify-center bg-zinc-800">
          <i :class="[getAssetIcon(asset.type), 'text-3xl text-zinc-600 transition-colors group-hover:text-amber-400']" />
          <!-- Type Badge -->
          <div class="absolute right-1.5 top-1.5">
            <span class="rounded bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 backdrop-blur-sm">
              {{ getAssetTypeLabel(asset.type) }}
            </span>
          </div>
          <!-- Add button -->
          <button
            class="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded bg-white/90 text-zinc-800 opacity-0 transition-all hover:bg-white group-hover:opacity-100"
            @click.stop
          >
            <i class="pi pi-plus text-xs" />
          </button>
        </div>
        <!-- Content -->
        <div class="p-2">
          <div class="truncate text-xs font-medium text-zinc-200 group-hover:text-white">
            {{ asset.name }}
          </div>
          <div v-if="asset.description" class="mt-0.5 truncate text-[10px] text-zinc-500">
            {{ asset.description }}
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
