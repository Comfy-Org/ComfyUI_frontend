<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  WorkspaceViewHeader,
  WorkspaceSearchInput,
  WorkspaceViewToggle,
  WorkspaceSortSelect,
  WorkspaceFilterSelect,
  WorkspaceCard,
} from '@/components/v2/workspace'

type ViewMode = 'grid' | 'list'

interface RecentItem {
  id: string
  name: string
  type: 'canvas' | 'workflow' | 'asset' | 'project'
  icon: string
  updatedAt: string
  thumbnail: string
}

const searchQuery = ref('')
const viewMode = ref<ViewMode>('grid')
const sortBy = ref('recent')
const filterBy = ref('all')

const sortOptions = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
]

const filterOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'canvas', label: 'Canvas' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'project', label: 'Project' },
  { value: 'asset', label: 'Asset' },
]

const recentItems = ref<RecentItem[]>([
  { id: '1', name: 'Portrait Generation', type: 'canvas', icon: 'pi pi-objects-column', updatedAt: '2 minutes ago', thumbnail: '/thumbnails/canvas-1.jpg' },
  { id: '2', name: 'SDXL Workflow', type: 'workflow', icon: 'pi pi-sitemap', updatedAt: '15 minutes ago', thumbnail: '/thumbnails/workflow-1.jpg' },
  { id: '3', name: 'Product Shots', type: 'project', icon: 'pi pi-folder', updatedAt: '1 hour ago', thumbnail: '/thumbnails/project-1.jpg' },
  { id: '4', name: 'reference_image.png', type: 'asset', icon: 'pi pi-image', updatedAt: '2 hours ago', thumbnail: '/thumbnails/asset-1.jpg' },
  { id: '5', name: 'Inpainting Canvas', type: 'canvas', icon: 'pi pi-objects-column', updatedAt: '3 hours ago', thumbnail: '/thumbnails/canvas-2.jpg' },
  { id: '6', name: 'ControlNet Pipeline', type: 'workflow', icon: 'pi pi-sitemap', updatedAt: '5 hours ago', thumbnail: '/thumbnails/workflow-2.jpg' },
  { id: '7', name: 'Marketing Assets', type: 'project', icon: 'pi pi-folder', updatedAt: 'Yesterday', thumbnail: '/thumbnails/project-2.jpg' },
  { id: '8', name: 'logo_v2.png', type: 'asset', icon: 'pi pi-image', updatedAt: 'Yesterday', thumbnail: '/thumbnails/asset-2.jpg' },
])

const filteredItems = computed(() => {
  let items = [...recentItems.value]

  // Filter by type
  if (filterBy.value !== 'all') {
    items = items.filter(item => item.type === filterBy.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(item => item.name.toLowerCase().includes(query))
  }

  // Sort items
  if (sortBy.value === 'name') {
    items.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'type') {
    items.sort((a, b) => a.type.localeCompare(b.type))
  }

  return items
})

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    canvas: 'Canvas',
    workflow: 'Workflow',
    asset: 'Asset',
    project: 'Project'
  }
  return labels[type] || type
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    canvas: 'bg-blue-500/20 text-blue-400',
    workflow: 'bg-purple-500/20 text-purple-400',
    asset: 'bg-green-500/20 text-green-400',
    project: 'bg-amber-500/20 text-amber-400'
  }
  return colors[type] || 'bg-zinc-500/20 text-zinc-400'
}

</script>

<template>
  <div class="p-6">
    <WorkspaceViewHeader
      title="Recents"
      subtitle="Recently accessed items"
      :show-create-buttons="true"
    />

    <!-- Search & Actions Toolbar -->
    <div class="mb-4 flex items-center gap-3">
      <WorkspaceSearchInput
        v-model="searchQuery"
        placeholder="Search recents..."
      />
      <WorkspaceViewToggle v-model="viewMode" />
      <WorkspaceSortSelect v-model="sortBy" :options="sortOptions" />
      <WorkspaceFilterSelect v-model="filterBy" :options="filterOptions" />
    </div>

    <!-- Grid View -->
    <div
      v-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <WorkspaceCard
        v-for="item in filteredItems"
        :key="item.id"
        :thumbnail="item.thumbnail"
        :title="item.name"
        :icon="item.icon"
        :badge="getTypeLabel(item.type)"
        :badge-class="getTypeColor(item.type)"
        :updated-at="item.updatedAt"
      />
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
            <i :class="['pi', item.icon, 'text-zinc-500 dark:text-zinc-400']" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ item.name }}</p>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              <span :class="['rounded px-1.5 py-0.5 text-[10px] font-medium', getTypeColor(item.type)]">
                {{ getTypeLabel(item.type) }}
              </span>
            </p>
          </div>
          <span class="text-sm text-zinc-400 dark:text-zinc-500">{{ item.updatedAt }}</span>
          <button
            class="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            @click.stop
          >
            <i class="pi pi-ellipsis-h text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredItems.length === 0" class="py-12 text-center">
      <i class="pi pi-search mb-4 text-4xl text-zinc-300 dark:text-zinc-600" />
      <p class="text-zinc-500 dark:text-zinc-400">No items found</p>
    </div>
  </div>
</template>
