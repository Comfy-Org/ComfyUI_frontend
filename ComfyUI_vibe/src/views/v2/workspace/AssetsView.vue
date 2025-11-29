<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { WorkspaceCard } from '@/components/v2/workspace'

const route = useRoute()
const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Filter type
type AssetType = 'all' | 'image' | 'video' | 'audio'
const filterType = ref<AssetType>('all')

// Sort
type SortOption = 'name' | 'updated' | 'size' | 'type'
const sortBy = ref<SortOption>('updated')

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'type', label: 'Type' }
]

// Mock assets data
const assets = ref([
  { id: 'asset-1', name: 'input-image.png', type: 'image', size: '2.4 MB', sizeBytes: 2516582, dimensions: '1024x1024', updatedAt: '2 hours ago', updatedTimestamp: Date.now() - 2 * 60 * 60 * 1000, thumbnail: '/thumbnails/asset-1.jpg' },
  { id: 'asset-2', name: 'reference.jpg', type: 'image', size: '1.8 MB', sizeBytes: 1887437, dimensions: '768x768', updatedAt: '1 day ago', updatedTimestamp: Date.now() - 24 * 60 * 60 * 1000, thumbnail: '/thumbnails/asset-2.jpg' },
  { id: 'asset-3', name: 'mask.png', type: 'image', size: '0.5 MB', sizeBytes: 524288, dimensions: '512x512', updatedAt: '2 days ago', updatedTimestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, thumbnail: '/assets/card_images/workflow_01.webp' },
  { id: 'asset-4', name: 'output-video.mp4', type: 'video', size: '24.5 MB', sizeBytes: 25690112, dimensions: '1920x1080', updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp' },
  { id: 'asset-5', name: 'background.wav', type: 'audio', size: '8.2 MB', sizeBytes: 8598323, dimensions: '3:24', updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, thumbnail: '/assets/card_images/bacb46ea-7e63-4f19-a253-daf41461e98f.webp' }
])

// Search, filter and sort
const searchQuery = ref('')
const filteredAssets = computed(() => {
  let result = assets.value

  // Filter by type
  if (filterType.value !== 'all') {
    result = result.filter((a) => a.type === filterType.value)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((a) => a.name.toLowerCase().includes(query))
  }

  // Sort
  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'size':
        return b.sizeBytes - a.sizeBytes
      case 'type':
        return a.type.localeCompare(b.type)
      case 'updated':
      default:
        return b.updatedTimestamp - a.updatedTimestamp
    }
  })

  return result
})

function getAssetIcon(type: string): string {
  switch (type) {
    case 'image': return 'pi pi-image'
    case 'video': return 'pi pi-video'
    case 'audio': return 'pi pi-volume-up'
    default: return 'pi pi-file'
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Assets
        </h1>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {{ assets.length }} files
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RouterLink
          :to="`/${workspaceId}/create`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i class="pi pi-bolt text-xs" />
          Linear
        </RouterLink>
        <RouterLink
          :to="`/${workspaceId}/canvas`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i class="pi pi-share-alt text-xs" />
          Node
        </RouterLink>
        <button
          class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <i class="pi pi-upload text-xs" />
          Upload
        </button>
      </div>
    </div>

    <!-- Search, Filter, Sort & View Toggle -->
    <div class="mb-6 flex items-center gap-3">
      <div class="relative flex-1">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search assets..."
          class="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        />
      </div>

      <!-- Type Filter -->
      <div class="flex rounded-md border border-zinc-200 dark:border-zinc-700">
        <button
          v-for="type in ['all', 'image', 'video', 'audio'] as AssetType[]"
          :key="type"
          :class="[
            'px-3 py-2 text-sm capitalize transition-colors',
            filterType === type
              ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          ]"
          @click="filterType = type"
        >
          {{ type }}
        </button>
      </div>

      <!-- Sort -->
      <div class="relative">
        <select
          v-model="sortBy"
          class="appearance-none rounded-md border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm text-zinc-700 outline-none transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        >
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <i class="pi pi-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400" />
      </div>

      <!-- View Toggle -->
      <div class="flex rounded-md border border-zinc-200 dark:border-zinc-700">
        <button
          :class="[
            'px-3 py-2 text-sm transition-colors',
            viewMode === 'grid'
              ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          ]"
          @click="viewMode = 'grid'"
        >
          <i class="pi pi-th-large" />
        </button>
        <button
          :class="[
            'px-3 py-2 text-sm transition-colors',
            viewMode === 'list'
              ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          ]"
          @click="viewMode = 'list'"
        >
          <i class="pi pi-list" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="filteredAssets.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-images text-xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No assets found</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ searchQuery || filterType !== 'all' ? 'Try different filters' : 'Upload files to get started' }}
      </p>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <WorkspaceCard
        v-for="asset in filteredAssets"
        :key="asset.id"
        :thumbnail="asset.thumbnail"
        :title="asset.name"
        :icon="getAssetIcon(asset.type)"
        :stats="[
          { icon: '', value: asset.dimensions },
          { icon: '', value: asset.size }
        ]"
      />
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
            <i :class="[getAssetIcon(asset.type), 'text-zinc-500 dark:text-zinc-400']" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ asset.name }}</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ asset.type }} - {{ asset.dimensions }}</p>
          </div>
          <span class="text-sm text-zinc-400 dark:text-zinc-500">{{ asset.size }}</span>
          <span class="text-sm text-zinc-400 dark:text-zinc-500">{{ asset.updatedAt }}</span>
          <button class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300">
            <i class="pi pi-download text-sm" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
