<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Filter type
type ModelType = 'all' | 'checkpoint' | 'lora' | 'vae' | 'controlnet'
const filterType = ref<ModelType>('all')

// Sort
type SortOption = 'name' | 'updated' | 'size' | 'type'
const sortBy = ref<SortOption>('updated')

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'type', label: 'Type' }
]

// Mock models data
const models = ref([
  { id: 'model-1', name: 'SDXL Base 1.0', type: 'checkpoint', size: '6.94 GB', sizeBytes: 7452139315, version: '1.0', updatedAt: '2 weeks ago', updatedTimestamp: Date.now() - 14 * 24 * 60 * 60 * 1000 },
  { id: 'model-2', name: 'SDXL Refiner 1.0', type: 'checkpoint', size: '6.08 GB', sizeBytes: 6529336320, version: '1.0', updatedAt: '2 weeks ago', updatedTimestamp: Date.now() - 14 * 24 * 60 * 60 * 1000 },
  { id: 'model-3', name: 'SDXL Lightning', type: 'lora', size: '393 MB', sizeBytes: 412090368, version: '4-step', updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { id: 'model-4', name: 'Detail Tweaker', type: 'lora', size: '144 MB', sizeBytes: 150994944, version: '1.0', updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
  { id: 'model-5', name: 'SDXL VAE', type: 'vae', size: '335 MB', sizeBytes: 351272960, version: 'fp16', updatedAt: '1 month ago', updatedTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 },
  { id: 'model-6', name: 'ControlNet Canny', type: 'controlnet', size: '2.5 GB', sizeBytes: 2684354560, version: '1.1', updatedAt: '2 weeks ago', updatedTimestamp: Date.now() - 14 * 24 * 60 * 60 * 1000 }
])

// Search, filter and sort
const searchQuery = ref('')
const filteredModels = computed(() => {
  let result = models.value

  // Filter by type
  if (filterType.value !== 'all') {
    result = result.filter((m) => m.type === filterType.value)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((m) => m.name.toLowerCase().includes(query))
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

function getModelIcon(type: string): string {
  switch (type) {
    case 'checkpoint': return 'pi pi-box'
    case 'lora': return 'pi pi-bolt'
    case 'vae': return 'pi pi-sliders-h'
    case 'controlnet': return 'pi pi-sitemap'
    default: return 'pi pi-cube'
  }
}

function getModelColor(type: string): string {
  switch (type) {
    case 'checkpoint': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    case 'lora': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
    case 'vae': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
    case 'controlnet': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
    default: return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Models
        </h1>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {{ models.length }} models installed
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
          <i class="pi pi-plus text-xs" />
          Add Model
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
          placeholder="Search models..."
          class="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        />
      </div>

      <!-- Type Filter -->
      <div class="flex rounded-md border border-zinc-200 dark:border-zinc-700">
        <button
          v-for="type in ['all', 'checkpoint', 'lora', 'vae', 'controlnet'] as ModelType[]"
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
      v-if="filteredModels.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-box text-xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No models found</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ searchQuery || filterType !== 'all' ? 'Try different filters' : 'Add models to get started' }}
      </p>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <div
        v-for="model in filteredModels"
        :key="model.id"
        class="group aspect-square cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      >
        <div class="flex h-full flex-col">
          <div class="flex items-start justify-between">
            <div :class="['flex h-10 w-10 items-center justify-center rounded-md', getModelColor(model.type)]">
              <i :class="getModelIcon(model.type)" />
            </div>
            <button
              class="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              @click.stop
            >
              <i class="pi pi-ellipsis-h text-sm" />
            </button>
          </div>
          <div class="mt-auto">
            <h3 class="font-medium text-zinc-900 dark:text-zinc-100">{{ model.name }}</h3>
            <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              v{{ model.version }}
            </p>
            <div class="mt-2 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
              <span :class="['rounded-full px-2 py-0.5 text-xs font-medium capitalize', getModelColor(model.type)]">
                {{ model.type }}
              </span>
              <span>{{ model.size }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="model in filteredModels"
          :key="model.id"
          class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div :class="['flex h-10 w-10 items-center justify-center rounded-md', getModelColor(model.type)]">
            <i :class="getModelIcon(model.type)" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ model.name }}</p>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">Version {{ model.version }}</p>
          </div>
          <span :class="['rounded-full px-2 py-0.5 text-xs font-medium capitalize', getModelColor(model.type)]">
            {{ model.type }}
          </span>
          <span class="w-20 text-right text-sm text-zinc-400 dark:text-zinc-500">{{ model.size }}</span>
          <span class="w-24 text-right text-sm text-zinc-400 dark:text-zinc-500">{{ model.updatedAt }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
