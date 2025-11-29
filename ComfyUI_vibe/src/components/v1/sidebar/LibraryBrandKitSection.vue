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
        {{ assets.length }}
      </span>
    </button>

    <!-- Items -->
    <div v-if="expanded" class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2">
      <!-- Colors Row -->
      <div class="px-2 py-1.5">
        <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Colors</div>
        <div class="flex gap-2">
          <div
            v-for="asset in assets.filter(a => a.type === 'color')"
            :key="asset.id"
            v-tooltip.top="{ value: asset.name, showDelay: 50 }"
            class="group relative cursor-pointer"
          >
            <div
              class="h-6 w-6 rounded border border-zinc-700 transition-transform group-hover:scale-110"
              :style="{ backgroundColor: asset.value }"
            />
          </div>
        </div>
      </div>
      <!-- Other Assets -->
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
    <div class="mb-1.5 flex items-center gap-2 px-1">
      <i class="pi pi-palette text-xs text-amber-400" />
      <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Brand Kit</span>
    </div>
    <div class="grid grid-cols-3 gap-1.5">
      <div
        v-for="asset in assets.filter(a => a.type === 'color')"
        :key="asset.id"
        v-tooltip.top="{ value: asset.name, showDelay: 50 }"
        class="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-2 transition-all hover:border-zinc-700"
      >
        <div class="mb-1.5 h-8 w-full rounded" :style="{ backgroundColor: asset.value }" />
        <div class="truncate text-[10px] text-zinc-500">{{ asset.name }}</div>
      </div>
      <div
        v-for="asset in assets.filter(a => a.type !== 'color')"
        :key="asset.id"
        class="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-2 transition-all hover:border-zinc-700"
      >
        <div class="mb-1.5 flex h-8 items-center justify-center rounded bg-zinc-800">
          <i :class="[getAssetIcon(asset.type), 'text-base text-zinc-600']" />
        </div>
        <div class="truncate text-[10px] text-zinc-400">{{ asset.name }}</div>
      </div>
    </div>
  </template>
</template>
