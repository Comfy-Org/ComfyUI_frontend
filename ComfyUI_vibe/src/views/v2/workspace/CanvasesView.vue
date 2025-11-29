<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Mock canvases data (all canvases across projects)
const canvases = ref([
  { id: 'main-workflow', name: 'Main Workflow', projectId: 'img-gen', projectName: 'Image Generation', updatedAt: '2 hours ago' },
  { id: 'test-canvas', name: 'Test Canvas', projectId: 'img-gen', projectName: 'Image Generation', updatedAt: '1 day ago' },
  { id: 'upscale-4x', name: 'Upscale 4x', projectId: 'upscale', projectName: 'Upscaling', updatedAt: '2 days ago' },
  { id: 'video-enhance', name: 'Video Enhance', projectId: 'video-proc', projectName: 'Video Processing', updatedAt: '3 days ago' },
  { id: 'audio-clean', name: 'Audio Clean', projectId: 'audio-enh', projectName: 'Audio Enhancement', updatedAt: '5 days ago' },
  { id: 'backup', name: 'Backup', projectId: 'img-gen', projectName: 'Image Generation', updatedAt: '1 week ago' }
])

// Search
const searchQuery = ref('')
const filteredCanvases = computed(() => {
  if (!searchQuery.value) return canvases.value
  const query = searchQuery.value.toLowerCase()
  return canvases.value.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.projectName.toLowerCase().includes(query)
  )
})

function openCanvas(canvas: { id: string; projectId: string }): void {
  router.push(`/${workspaceId.value}/${canvas.projectId}/${canvas.id}`)
}

function createCanvas(): void {
  router.push(`/${workspaceId.value}/default/untitled`)
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Canvases
        </h1>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {{ canvases.length }} canvases across all projects
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        @click="createCanvas"
      >
        <i class="pi pi-plus text-xs" />
        New Canvas
      </button>
    </div>

    <!-- Search & View Toggle -->
    <div class="mb-6 flex items-center gap-4">
      <div class="relative flex-1">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search canvases..."
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
      v-if="filteredCanvases.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-objects-column text-xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No canvases found</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ searchQuery ? 'Try a different search term' : 'Get started by creating a new canvas' }}
      </p>
      <button
        v-if="!searchQuery"
        class="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        @click="createCanvas"
      >
        <i class="pi pi-plus text-xs" />
        New Canvas
      </button>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <button
        v-for="canvas in filteredCanvases"
        :key="canvas.id"
        class="group rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        @click="openCanvas(canvas)"
      >
        <div class="mb-3 flex h-24 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
          <i class="pi pi-objects-column text-2xl text-zinc-400" />
        </div>
        <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ canvas.name }}</p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span class="inline-flex items-center gap-1">
            <i class="pi pi-folder text-[10px]" />
            {{ canvas.projectName }}
          </span>
        </p>
        <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Updated {{ canvas.updatedAt }}</p>
      </button>
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
            <i class="pi pi-objects-column text-zinc-500 dark:text-zinc-400" />
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
