<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  WorkspaceViewHeader,
  WorkspaceEmptyState,
  WorkspaceViewToggle,
  WorkspaceSearchInput,
  WorkspaceSortSelect,
  CreateProjectDialog,
} from '@/components/v2/workspace'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Sort
type SortOption = 'name' | 'updated' | 'canvases'
const sortBy = ref<SortOption>('updated')

const sortOptions = [
  { value: 'updated', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'canvases', label: 'Canvas count' }
]

// Projects data
const projects = ref([
  { id: 'img-gen', name: 'Image Generation', description: 'AI image generation workflows', canvasCount: 5, modelCount: 12, updatedAt: '2 hours ago', updatedTimestamp: Date.now() - 2 * 60 * 60 * 1000 },
  { id: 'video-proc', name: 'Video Processing', description: 'Video enhancement and editing', canvasCount: 3, modelCount: 8, updatedAt: '1 day ago', updatedTimestamp: Date.now() - 24 * 60 * 60 * 1000 },
  { id: 'audio-enh', name: 'Audio Enhancement', description: 'Audio processing pipelines', canvasCount: 2, modelCount: 4, updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
  { id: 'upscale', name: 'Upscaling', description: 'Image and video upscaling', canvasCount: 4, modelCount: 6, updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 }
])

// Create dialog
const showCreateDialog = ref(false)

function handleCreateProject(data: { name: string; description: string }): void {
  const id = data.name.toLowerCase().replace(/\s+/g, '-')
  projects.value.unshift({
    id,
    name: data.name,
    description: data.description,
    canvasCount: 0,
    modelCount: 0,
    updatedAt: 'Just now',
    updatedTimestamp: Date.now()
  })
}

function openProject(projectId: string): void {
  router.push(`/${workspaceId.value}/${projectId}`)
}

// Search and sort
const searchQuery = ref('')
const filteredProjects = computed(() => {
  let result = projects.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    )
  }

  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'canvases':
        return b.canvasCount - a.canvasCount
      case 'updated':
      default:
        return b.updatedTimestamp - a.updatedTimestamp
    }
  })

  return result
})

const emptyStateDescription = computed(() =>
  searchQuery.value ? 'Try a different search term' : 'Get started by creating a new project'
)
</script>

<template>
  <div class="p-6">
    <WorkspaceViewHeader
      title="Projects"
      :subtitle="`${projects.length} projects`"
      action-label="New Project"
      @action="showCreateDialog = true"
    />

    <!-- Search, Sort & View Toggle -->
    <div class="mb-6 flex items-center gap-3">
      <WorkspaceSearchInput
        v-model="searchQuery"
        placeholder="Search projects..."
      />
      <WorkspaceSortSelect v-model="sortBy" :options="sortOptions" />
      <WorkspaceViewToggle v-model="viewMode" />
    </div>

    <!-- Empty State -->
    <WorkspaceEmptyState
      v-if="filteredProjects.length === 0"
      icon="pi pi-folder"
      title="No projects found"
      :description="emptyStateDescription"
      :action-label="searchQuery ? undefined : 'New Project'"
      @action="showCreateDialog = true"
    />

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="group aspect-square cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        @click="openProject(project.id)"
      >
        <div class="flex h-full flex-col">
          <div class="flex items-start justify-between">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <i class="pi pi-folder text-zinc-500 dark:text-zinc-400" />
            </div>
            <button
              class="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              @click.stop
            >
              <i class="pi pi-ellipsis-h text-sm" />
            </button>
          </div>
          <div class="mt-auto">
            <h3 class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.name }}</h3>
            <p class="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
              {{ project.description }}
            </p>
            <div class="mt-2 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span class="flex items-center gap-1">
                <i class="pi pi-objects-column" />
                {{ project.canvasCount }}
              </span>
              <span class="flex items-center gap-1">
                <i class="pi pi-box" />
                {{ project.modelCount }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="project in filteredProjects"
          :key="project.id"
          class="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          @click="openProject(project.id)"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
            <i class="pi pi-folder text-zinc-500 dark:text-zinc-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ project.name }}</p>
            <p class="truncate text-sm text-zinc-500 dark:text-zinc-400">{{ project.description }}</p>
          </div>
          <div class="flex items-center gap-6 text-sm text-zinc-400 dark:text-zinc-500">
            <span class="flex items-center gap-1">
              <i class="pi pi-objects-column text-xs" />
              {{ project.canvasCount }}
            </span>
            <span class="flex items-center gap-1">
              <i class="pi pi-box text-xs" />
              {{ project.modelCount }}
            </span>
            <span class="w-24 text-right">{{ project.updatedAt }}</span>
          </div>
          <button
            class="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            @click.stop
          >
            <i class="pi pi-ellipsis-h text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create Dialog -->
    <CreateProjectDialog
      v-model:visible="showCreateDialog"
      @create="handleCreateProject"
    />
  </div>
</template>
