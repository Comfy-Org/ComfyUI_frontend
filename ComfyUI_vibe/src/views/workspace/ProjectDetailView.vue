<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.workspaceId as string)
const projectId = computed(() => route.params.projectId as string)

// Mock project data
const project = computed(() => ({
  id: projectId.value,
  name: projectId.value.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  description: 'Project description goes here'
}))

// Mock canvases for this project
const canvases = ref([
  { id: 'main-workflow', name: 'Main Workflow', updatedAt: '2 hours ago' },
  { id: 'test-canvas', name: 'Test Canvas', updatedAt: '1 day ago' },
  { id: 'backup', name: 'Backup', updatedAt: '3 days ago' }
])

// Mock assets
const assets = ref([
  { id: 'asset-1', name: 'input-image.png', type: 'image', size: '2.4 MB' },
  { id: 'asset-2', name: 'reference.jpg', type: 'image', size: '1.8 MB' },
  { id: 'asset-3', name: 'mask.png', type: 'image', size: '0.5 MB' }
])

// Tabs
type Tab = 'canvases' | 'assets'
const activeTab = ref<Tab>('canvases')

function openCanvas(canvasId: string): void {
  router.push(`/${workspaceId.value}/${projectId.value}/${canvasId}`)
}

function createCanvas(): void {
  router.push(`/${workspaceId.value}/${projectId.value}/untitled`)
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <button
          class="hover:text-zinc-700 dark:hover:text-zinc-300"
          @click="router.push(`/${workspaceId}/projects`)"
        >
          Projects
        </button>
        <i class="pi pi-chevron-right text-xs" />
        <span class="text-zinc-700 dark:text-zinc-300">{{ project.name }}</span>
      </div>
      <div class="mt-2 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <i class="pi pi-folder text-lg text-zinc-500 dark:text-zinc-400" />
          </div>
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {{ project.name }}
            </h1>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">{{ project.description }}</p>
          </div>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          @click="createCanvas"
        >
          <i class="pi pi-plus text-xs" />
          New Canvas
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mb-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      <button
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors',
          activeTab === 'canvases'
            ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
        ]"
        @click="activeTab = 'canvases'"
      >
        Canvases
        <span class="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
          {{ canvases.length }}
        </span>
      </button>
      <button
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors',
          activeTab === 'assets'
            ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
        ]"
        @click="activeTab = 'assets'"
      >
        Assets
        <span class="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
          {{ assets.length }}
        </span>
      </button>
    </div>

    <!-- Canvases Tab -->
    <div v-if="activeTab === 'canvases'">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <!-- New Canvas Card -->
        <button
          class="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
          @click="createCanvas"
        >
          <i class="pi pi-plus text-2xl" />
          <span class="text-sm font-medium">New Canvas</span>
        </button>

        <!-- Canvas Cards -->
        <button
          v-for="canvas in canvases"
          :key="canvas.id"
          class="group aspect-square rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          @click="openCanvas(canvas.id)"
        >
          <div class="flex h-full flex-col">
            <div class="flex flex-1 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <i class="pi pi-objects-column text-2xl text-zinc-400" />
            </div>
            <div class="mt-3">
              <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ canvas.name }}</p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ canvas.updatedAt }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Assets Tab -->
    <div v-if="activeTab === 'assets'">
      <div class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div
            v-for="asset in assets"
            :key="asset.id"
            class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              <i class="pi pi-image text-zinc-500 dark:text-zinc-400" />
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ asset.name }}</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ asset.type }} • {{ asset.size }}</p>
            </div>
            <button class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300">
              <i class="pi pi-download text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
