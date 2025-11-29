<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  WorkspaceViewHeader,
  WorkspaceEmptyState,
  WorkspaceViewToggle,
  WorkspaceSearchInput,
  WorkspaceSortSelect,
} from '@/components/v2/workspace'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Sort options
type SortOption = 'name' | 'updated' | 'project'
const sortBy = ref<SortOption>('updated')

const sortOptions = [
  { value: 'updated', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'project', label: 'Project' }
]

// Project filter
const filterProject = ref<string>('all')

// Search
const searchQuery = ref('')

// Mock canvases data
const canvases = ref([
  { id: 'main-workflow', name: 'Main Workflow', projectId: 'img-gen', projectName: 'Image Generation', updatedAt: '2 hours ago', updatedTimestamp: Date.now() - 2 * 60 * 60 * 1000 },
  { id: 'test-canvas', name: 'Test Canvas', projectId: 'img-gen', projectName: 'Image Generation', updatedAt: '1 day ago', updatedTimestamp: Date.now() - 24 * 60 * 60 * 1000 },
  { id: 'upscale-4x', name: 'Upscale 4x', projectId: 'upscale', projectName: 'Upscaling', updatedAt: '2 days ago', updatedTimestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 },
  { id: 'video-enhance', name: 'Video Enhance', projectId: 'video-proc', projectName: 'Video Processing', updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
  { id: 'audio-clean', name: 'Audio Clean', projectId: 'audio-enh', projectName: 'Audio Enhancement', updatedAt: '5 days ago', updatedTimestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 },
  { id: 'backup', name: 'Backup', projectId: 'img-gen', projectName: 'Image Generation', updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 }
])

// Get unique projects for filter
const projectOptions = computed(() => {
  const projects = new Map<string, string>()
  canvases.value.forEach((c) => {
    projects.set(c.projectId, c.projectName)
  })
  return [
    { value: 'all', label: 'All projects' },
    ...Array.from(projects.entries()).map(([id, name]) => ({ value: id, label: name }))
  ]
})

// Filter and sort canvases
const filteredCanvases = computed(() => {
  let result = canvases.value

  if (filterProject.value !== 'all') {
    result = result.filter((c) => c.projectId === filterProject.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.projectName.toLowerCase().includes(query)
    )
  }

  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'project':
        return a.projectName.localeCompare(b.projectName)
      case 'updated':
      default:
        return b.updatedTimestamp - a.updatedTimestamp
    }
  })

  return result
})

function openCanvas(canvas: { id: string; projectId: string }): void {
  router.push(`/${workspaceId.value}/${canvas.projectId}/${canvas.id}`)
}

function createCanvas(): void {
  router.push(`/${workspaceId.value}/default/untitled`)
}

const emptyStateDescription = computed(() =>
  searchQuery.value ? 'Try a different search term' : 'Get started by creating a new canvas'
)
</script>

<template>
  <div class="p-6">
    <WorkspaceViewHeader
      title="Canvases"
      :subtitle="`${canvases.length} canvases`"
      action-label="New Canvas"
      @action="createCanvas"
    />

    <!-- Search, Filter, Sort & View Toggle -->
    <div class="mb-6 flex items-center gap-3">
      <WorkspaceSearchInput
        v-model="searchQuery"
        placeholder="Search canvases..."
      />
      <WorkspaceSortSelect v-model="filterProject" :options="projectOptions" />
      <WorkspaceSortSelect v-model="sortBy" :options="sortOptions" />
      <WorkspaceViewToggle v-model="viewMode" />
    </div>

    <!-- Empty State -->
    <WorkspaceEmptyState
      v-if="filteredCanvases.length === 0"
      icon="pi pi-sitemap"
      title="No canvases found"
      :description="emptyStateDescription"
    />

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <div
        v-for="canvas in filteredCanvases"
        :key="canvas.id"
        class="group aspect-square cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        @click="openCanvas(canvas)"
      >
        <div class="flex h-full flex-col">
          <div class="flex items-start justify-between">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <i class="pi pi-sitemap text-zinc-500 dark:text-zinc-400" />
            </div>
            <button
              class="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              @click.stop
            >
              <i class="pi pi-ellipsis-h text-sm" />
            </button>
          </div>
          <div class="mt-auto">
            <h3 class="font-medium text-zinc-900 dark:text-zinc-100">{{ canvas.name }}</h3>
            <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span class="inline-flex items-center gap-1">
                <i class="pi pi-folder text-xs" />
                {{ canvas.projectName }}
              </span>
            </p>
            <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{{ canvas.updatedAt }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <button
          v-for="canvas in filteredCanvases"
          :key="canvas.id"
          class="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          @click="openCanvas(canvas)"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
            <i class="pi pi-sitemap text-zinc-500 dark:text-zinc-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ canvas.name }}</p>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              <span class="inline-flex items-center gap-1">
                <i class="pi pi-folder text-xs" />
                {{ canvas.projectName }}
              </span>
            </p>
          </div>
          <span class="text-sm text-zinc-400 dark:text-zinc-500">{{ canvas.updatedAt }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
