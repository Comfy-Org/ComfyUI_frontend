<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { WorkspaceCard } from '@/components/v2/workspace'

const route = useRoute()
const workspaceId = computed(() => route.params.workspaceId as string)

// View mode
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')

// Sort
type SortOption = 'name' | 'updated' | 'nodes'
const sortBy = ref<SortOption>('updated')

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'nodes', label: 'Node count' }
]

// Mock workflows data
const workflows = ref([
  { id: 'txt2img-basic', name: 'Text to Image Basic', description: 'Simple text to image generation', nodeCount: 8, updatedAt: '1 day ago', updatedTimestamp: Date.now() - 24 * 60 * 60 * 1000, thumbnail: '/thumbnails/workflow-1.jpg' },
  { id: 'img2img-refine', name: 'Image Refinement', description: 'Refine and enhance images', nodeCount: 12, updatedAt: '2 days ago', updatedTimestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, thumbnail: '/thumbnails/workflow-2.jpg' },
  { id: 'upscale-4x', name: '4x Upscale', description: 'High quality image upscaling', nodeCount: 5, updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, thumbnail: '/assets/card_images/can-you-rate-my-comfyui-workflow-v0-o9clchhji39c1.webp' },
  { id: 'controlnet-pose', name: 'ControlNet Pose', description: 'Pose-guided generation', nodeCount: 15, updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, thumbnail: '/assets/card_images/dda28581-37c8-44da-8822-57d1ccc2118c_2130x1658.png' }
])

// Search and sort
const searchQuery = ref('')
const filteredWorkflows = computed(() => {
  let result = workflows.value

  // Filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query)
    )
  }

  // Sort
  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'nodes':
        return b.nodeCount - a.nodeCount
      case 'updated':
      default:
        return b.updatedTimestamp - a.updatedTimestamp
    }
  })

  return result
})
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Workflows
        </h1>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {{ workflows.length }} saved workflows
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
          Import Workflow
        </button>
      </div>
    </div>

    <!-- Search, Sort & View Toggle -->
    <div class="mb-6 flex items-center gap-3">
      <div class="relative flex-1">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search workflows..."
          class="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        />
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
      v-if="filteredWorkflows.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-sitemap text-xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No workflows found</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ searchQuery ? 'Try a different search term' : 'Import or save a workflow to get started' }}
      </p>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <WorkspaceCard
        v-for="workflow in filteredWorkflows"
        :key="workflow.id"
        :thumbnail="workflow.thumbnail"
        :title="workflow.name"
        :description="workflow.description"
        icon="pi pi-sitemap"
        :stats="[{ icon: 'pi pi-stop', value: workflow.nodeCount }]"
        :updated-at="workflow.updatedAt"
      />
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="workflow in filteredWorkflows"
          :key="workflow.id"
          class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
            <i class="pi pi-sitemap text-zinc-500 dark:text-zinc-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ workflow.name }}</p>
            <p class="truncate text-sm text-zinc-500 dark:text-zinc-400">{{ workflow.description }}</p>
          </div>
          <div class="flex items-center gap-6 text-sm text-zinc-400 dark:text-zinc-500">
            <span class="flex items-center gap-1">
              <i class="pi pi-stop text-xs" />
              {{ workflow.nodeCount }}
            </span>
            <span class="w-24 text-right">{{ workflow.updatedAt }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
