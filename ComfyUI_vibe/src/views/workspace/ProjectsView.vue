<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Projects data
const projects = ref([
  { id: 'img-gen', name: 'Image Generation', description: 'AI image generation workflows', canvasCount: 5, modelCount: 12, updatedAt: '2 hours ago' },
  { id: 'video-proc', name: 'Video Processing', description: 'Video enhancement and editing', canvasCount: 3, modelCount: 8, updatedAt: '1 day ago' },
  { id: 'audio-enh', name: 'Audio Enhancement', description: 'Audio processing pipelines', canvasCount: 2, modelCount: 4, updatedAt: '3 days ago' },
  { id: 'upscale', name: 'Upscaling', description: 'Image and video upscaling', canvasCount: 4, modelCount: 6, updatedAt: '1 week ago' }
])

// Create dialog
const showCreateDialog = ref(false)
const newProject = ref({ name: '', description: '' })

function createProject(): void {
  if (!newProject.value.name.trim()) return

  const id = newProject.value.name.toLowerCase().replace(/\s+/g, '-')
  projects.value.unshift({
    id,
    name: newProject.value.name,
    description: newProject.value.description,
    canvasCount: 0,
    modelCount: 0,
    updatedAt: 'Just now'
  })

  showCreateDialog.value = false
  newProject.value = { name: '', description: '' }
}

function openProject(projectId: string): void {
  router.push(`/${workspaceId.value}/${projectId}`)
}

// Search
const searchQuery = ref('')
const filteredProjects = computed(() => {
  if (!searchQuery.value) return projects.value
  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
  )
})
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Projects
        </h1>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {{ projects.length }} projects
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        @click="showCreateDialog = true"
      >
        <i class="pi pi-plus text-xs" />
        New Project
      </button>
    </div>

    <!-- Search & View Toggle -->
    <div class="mb-6 flex items-center gap-4">
      <div class="relative flex-1">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search projects..."
          class="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        />
      </div>
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
      v-if="filteredProjects.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-folder text-xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No projects found</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ searchQuery ? 'Try a different search term' : 'Get started by creating a new project' }}
      </p>
      <button
        v-if="!searchQuery"
        class="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        @click="showCreateDialog = true"
      >
        <i class="pi pi-plus text-xs" />
        New Project
      </button>
    </div>

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
    <Dialog
      v-model:visible="showCreateDialog"
      :modal="true"
      :draggable="false"
      :style="{ width: '420px' }"
      :pt="{
        root: { class: 'border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg' },
        header: { class: 'border-b border-zinc-200 dark:border-zinc-700 px-6 py-4' },
        content: { class: 'p-6' },
        footer: { class: 'border-t border-zinc-200 dark:border-zinc-700 px-6 py-4' }
      }"
    >
      <template #header>
        <span class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create Project</span>
      </template>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
          <InputText
            v-model="newProject.name"
            placeholder="Project name"
            class="w-full"
            @keyup.enter="createProject"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
          <Textarea
            v-model="newProject.description"
            placeholder="Optional description"
            rows="3"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            class="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            @click="showCreateDialog = false"
          >
            Cancel
          </button>
          <button
            :disabled="!newProject.name.trim()"
            :class="[
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              newProject.name.trim()
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                : 'cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'
            ]"
            @click="createProject"
          >
            Create
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
