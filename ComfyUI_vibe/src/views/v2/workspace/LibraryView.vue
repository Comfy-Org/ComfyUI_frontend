<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import Popover from 'primevue/popover'
import {
  WorkspaceSearchInput,
  WorkspaceViewToggle,
  WorkspaceSortSelect,
  WorkspaceFilterSelect,
  WorkspaceCard,
} from '@/components/v2/workspace'

const route = useRoute()
const workspaceId = computed(() => route.params.workspaceId as string)

// Library/Brand switcher
interface Library {
  id: string
  name: string
  icon: string
  color: string
  itemCount: number
}

const libraries = ref<Library[]>([
  { id: 'netflix', name: 'Netflix', icon: 'pi pi-play', color: 'bg-red-600', itemCount: 248 },
  { id: 'adobe', name: 'Adobe Creative', icon: 'pi pi-palette', color: 'bg-rose-600', itemCount: 156 },
  { id: 'personal', name: 'My Library', icon: 'pi pi-user', color: 'bg-zinc-600', itemCount: 89 },
  { id: 'community', name: 'Community Hub', icon: 'pi pi-users', color: 'bg-violet-600', itemCount: 1240 },
])

const currentLibrary = ref<Library>(libraries.value[0])
const libraryMenu = ref<InstanceType<typeof Popover> | null>(null)

function toggleLibraryMenu(event: Event): void {
  libraryMenu.value?.toggle(event)
}

function selectLibrary(library: Library): void {
  currentLibrary.value = library
  libraryMenu.value?.hide()
}

// Category tabs
type CategoryId = 'all' | 'workflows' | 'models' | 'nodepacks' | 'assets' | 'brand-kit'

interface Category {
  id: CategoryId
  label: string
  icon: string
  count: number
}

const categories = ref<Category[]>([
  { id: 'all', label: 'All', icon: 'pi pi-th-large', count: 248 },
  { id: 'workflows', label: 'Workflows', icon: 'pi pi-sitemap', count: 64 },
  { id: 'models', label: 'Models', icon: 'pi pi-box', count: 38 },
  { id: 'nodepacks', label: 'Nodepacks', icon: 'pi pi-th-large', count: 24 },
  { id: 'assets', label: 'Assets', icon: 'pi pi-images', count: 89 },
  { id: 'brand-kit', label: 'Brand Kit', icon: 'pi pi-palette', count: 33 },
])

const activeCategory = ref<CategoryId>('all')

// View mode & filters
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>('grid')
const searchQuery = ref('')
const sortBy = ref('recent')
const filterBy = ref('all')

const sortOptions = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'name', label: 'Name' },
  { value: 'popular', label: 'Most Used' },
  { value: 'updated', label: 'Last Updated' },
]

const filterOptions = [
  { value: 'all', label: 'All Items' },
  { value: 'shared', label: 'Shared with me' },
  { value: 'owned', label: 'Created by me' },
  { value: 'favorited', label: 'Favorited' },
]

// Mock library items
interface LibraryItem {
  id: string
  name: string
  description: string
  type: CategoryId
  thumbnail: string
  icon: string
  author: string
  updatedAt: string
  updatedTimestamp: number
  uses: number
  isShared: boolean
  isFavorited: boolean
}

const items = ref<LibraryItem[]>([
  { id: '1', name: 'SDXL Base Pipeline', description: 'Standard text-to-image workflow with SDXL', type: 'workflows', thumbnail: '/assets/card_images/workflow_01.webp', icon: 'pi pi-sitemap', author: 'Netflix Design', updatedAt: '2 hours ago', updatedTimestamp: Date.now() - 2 * 60 * 60 * 1000, uses: 1250, isShared: true, isFavorited: true },
  { id: '2', name: 'ControlNet Canny', description: 'Edge-guided image generation', type: 'workflows', thumbnail: '/assets/card_images/comfyui_workflow.jpg', icon: 'pi pi-sitemap', author: 'Team', updatedAt: '1 day ago', updatedTimestamp: Date.now() - 24 * 60 * 60 * 1000, uses: 890, isShared: true, isFavorited: false },
  { id: '3', name: 'SDXL Lightning v1.0', description: '4-step fast generation checkpoint', type: 'models', thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp', icon: 'pi pi-box', author: 'ByteDance', updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, uses: 3420, isShared: false, isFavorited: true },
  { id: '4', name: 'Flux.1 Dev', description: 'High quality diffusion model', type: 'models', thumbnail: '/assets/card_images/bacb46ea-7e63-4f19-a253-daf41461e98f.webp', icon: 'pi pi-box', author: 'Black Forest', updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, uses: 5670, isShared: false, isFavorited: false },
  { id: '5', name: 'ComfyUI Manager', description: 'Install and manage custom nodes', type: 'nodepacks', thumbnail: '/assets/card_images/228616f4-12ad-426d-84fb-f20e488ba7ee.webp', icon: 'pi pi-th-large', author: 'Comfy Org', updatedAt: '2 weeks ago', updatedTimestamp: Date.now() - 14 * 24 * 60 * 60 * 1000, uses: 12400, isShared: false, isFavorited: true },
  { id: '6', name: 'Impact Pack', description: 'Advanced sampling and detailing', type: 'nodepacks', thumbnail: '/assets/card_images/683255d3-1d10-43d9-a6ff-ef142061e88a.webp', icon: 'pi pi-th-large', author: 'Dr.Lt.Data', updatedAt: '5 days ago', updatedTimestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, uses: 8900, isShared: false, isFavorited: false },
  { id: '7', name: 'Brand Logo Pack', description: 'Netflix brand logos in various formats', type: 'brand-kit', thumbnail: '/assets/card_images/91f1f589-ddb4-4c4f-b3a7-ba30fc271987.webp', icon: 'pi pi-palette', author: 'Brand Team', updatedAt: '1 month ago', updatedTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, uses: 450, isShared: true, isFavorited: false },
  { id: '8', name: 'Color Guidelines', description: 'Official brand color palette', type: 'brand-kit', thumbnail: '/assets/card_images/28e9f7ea-ef00-48e8-849d-8752a34939c7.webp', icon: 'pi pi-palette', author: 'Brand Team', updatedAt: '2 months ago', updatedTimestamp: Date.now() - 60 * 24 * 60 * 60 * 1000, uses: 890, isShared: true, isFavorited: true },
  { id: '9', name: 'Hero Images Q4', description: 'Generated hero images for campaigns', type: 'assets', thumbnail: '/assets/card_images/dda28581-37c8-44da-8822-57d1ccc2118c_2130x1658.png', icon: 'pi pi-images', author: 'Creative Team', updatedAt: '3 days ago', updatedTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, uses: 67, isShared: true, isFavorited: false },
  { id: '10', name: 'Social Media Assets', description: 'Generated social media graphics', type: 'assets', thumbnail: '/assets/card_images/can-you-rate-my-comfyui-workflow-v0-o9clchhji39c1.webp', icon: 'pi pi-images', author: 'Marketing', updatedAt: '1 week ago', updatedTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, uses: 234, isShared: true, isFavorited: false },
  { id: '11', name: 'Video Upscale 4K', description: 'AI-powered video upscaling workflow', type: 'workflows', thumbnail: '/assets/card_images/workflow_01.webp', icon: 'pi pi-sitemap', author: 'Video Team', updatedAt: '4 days ago', updatedTimestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, uses: 567, isShared: true, isFavorited: false },
  { id: '12', name: 'Typography Set', description: 'Brand approved fonts and styles', type: 'brand-kit', thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp', icon: 'pi pi-palette', author: 'Brand Team', updatedAt: '2 weeks ago', updatedTimestamp: Date.now() - 14 * 24 * 60 * 60 * 1000, uses: 320, isShared: true, isFavorited: false },
])

// Filtered and sorted items
const filteredItems = computed(() => {
  let result = [...items.value]

  // Filter by category
  if (activeCategory.value !== 'all') {
    result = result.filter(item => item.type === activeCategory.value)
  }

  // Filter by filter option
  if (filterBy.value === 'shared') {
    result = result.filter(item => item.isShared)
  } else if (filterBy.value === 'favorited') {
    result = result.filter(item => item.isFavorited)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.author.toLowerCase().includes(query)
    )
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'popular':
        return b.uses - a.uses
      case 'updated':
      case 'recent':
      default:
        return b.updatedTimestamp - a.updatedTimestamp
    }
  })

  return result
})

// Helpers
function getTypeColor(type: CategoryId): string {
  const colors: Record<string, string> = {
    workflows: 'bg-blue-500/20 text-blue-400',
    models: 'bg-purple-500/20 text-purple-400',
    nodepacks: 'bg-green-500/20 text-green-400',
    assets: 'bg-amber-500/20 text-amber-400',
    'brand-kit': 'bg-pink-500/20 text-pink-400',
  }
  return colors[type] || 'bg-zinc-500/20 text-zinc-400'
}

function getTypeLabel(type: CategoryId): string {
  const labels: Record<string, string> = {
    workflows: 'Workflow',
    models: 'Model',
    nodepacks: 'Nodepack',
    assets: 'Asset',
    'brand-kit': 'Brand Kit',
  }
  return labels[type] || type
}

function formatUses(uses: number): string {
  if (uses >= 1000) {
    return `${(uses / 1000).toFixed(1)}k`
  }
  return uses.toString()
}
</script>

<template>
  <div class="p-6">
    <!-- Header with Library Switcher -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <!-- Library Switcher -->
        <button
          class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
          @click="toggleLibraryMenu"
        >
          <div :class="['flex h-8 w-8 items-center justify-center rounded-md text-white', currentLibrary.color]">
            <i :class="[currentLibrary.icon, 'text-sm']" />
          </div>
          <div class="text-left">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ currentLibrary.name }}</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ currentLibrary.itemCount }} items</p>
          </div>
          <i class="pi pi-chevron-down text-xs text-zinc-400" />
        </button>

        <!-- Library Menu -->
        <Popover ref="libraryMenu" append-to="self">
          <div class="w-72 p-2">
            <p class="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Switch Library
            </p>
            <div class="mt-1 flex flex-col gap-0.5">
              <button
                v-for="lib in libraries"
                :key="lib.id"
                :class="[
                  'flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                  currentLibrary.id === lib.id
                    ? 'bg-zinc-100 dark:bg-zinc-700'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                ]"
                @click="selectLibrary(lib)"
              >
                <div :class="['flex h-8 w-8 items-center justify-center rounded-md text-white', lib.color]">
                  <i :class="[lib.icon, 'text-sm']" />
                </div>
                <div class="flex-1">
                  <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ lib.name }}</p>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ lib.itemCount }} items</p>
                </div>
                <i v-if="currentLibrary.id === lib.id" class="pi pi-check text-sm text-blue-500" />
              </button>
            </div>
          </div>
        </Popover>

        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Library Hub
          </h1>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Shared workflows, models, nodepacks, and brand assets
          </p>
        </div>
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
          Add to Library
        </button>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="mb-6 flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
      <button
        v-for="cat in categories"
        :key="cat.id"
        :class="[
          'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
          activeCategory === cat.id
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
        ]"
        @click="activeCategory = cat.id"
      >
        <i :class="[cat.icon, 'text-sm']" />
        {{ cat.label }}
        <span
          :class="[
            'rounded-full px-1.5 py-0.5 text-xs',
            activeCategory === cat.id
              ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200'
              : 'bg-zinc-200/50 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
          ]"
        >
          {{ cat.count }}
        </span>
      </button>
    </div>

    <!-- Search & Filters -->
    <div class="mb-4 flex items-center gap-3">
      <WorkspaceSearchInput
        v-model="searchQuery"
        placeholder="Search library..."
      />
      <WorkspaceViewToggle v-model="viewMode" />
      <WorkspaceSortSelect v-model="sortBy" :options="sortOptions" />
      <WorkspaceFilterSelect v-model="filterBy" :options="filterOptions" />
    </div>

    <!-- Empty State -->
    <div
      v-if="filteredItems.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-inbox text-xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No items found</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ searchQuery || filterBy !== 'all' ? 'Try different filters' : 'Add items to get started' }}
      </p>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <WorkspaceCard
        v-for="item in filteredItems"
        :key="item.id"
        :thumbnail="item.thumbnail"
        :title="item.name"
        :description="item.description"
        :icon="item.icon"
        :badge="getTypeLabel(item.type)"
        :badge-class="getTypeColor(item.type)"
        :stats="[
          { icon: 'pi pi-user', value: item.author },
          { icon: 'pi pi-chart-bar', value: formatUses(item.uses) }
        ]"
        :updated-at="item.updatedAt"
      />
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <!-- List Header -->
      <div class="flex items-center gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <div class="w-12">Icon</div>
        <div class="flex-1">Name</div>
        <div class="w-24">Type</div>
        <div class="w-24 text-right">Uses</div>
        <div class="w-28 text-right">Author</div>
        <div class="w-28 text-right">Updated</div>
        <div class="w-10"></div>
      </div>
      <!-- List Items -->
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div class="w-12">
            <div class="h-10 w-10 overflow-hidden rounded-md">
              <img :src="item.thumbnail" :alt="item.name" class="h-full w-full object-cover" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ item.name }}</p>
              <i v-if="item.isFavorited" class="pi pi-star-fill text-xs text-amber-400" />
              <i v-if="item.isShared" class="pi pi-share-alt text-xs text-zinc-400" />
            </div>
            <p class="truncate text-sm text-zinc-500 dark:text-zinc-400">{{ item.description }}</p>
          </div>
          <div class="w-24">
            <span :class="['rounded px-2 py-1 text-xs font-medium', getTypeColor(item.type)]">
              {{ getTypeLabel(item.type) }}
            </span>
          </div>
          <div class="w-24 text-right text-sm text-zinc-500 dark:text-zinc-400">
            {{ formatUses(item.uses) }}
          </div>
          <div class="w-28 truncate text-right text-sm text-zinc-500 dark:text-zinc-400">
            {{ item.author }}
          </div>
          <div class="w-28 text-right text-sm text-zinc-400 dark:text-zinc-500">
            {{ item.updatedAt }}
          </div>
          <div class="w-10">
            <button
              class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              @click.stop
            >
              <i class="pi pi-ellipsis-h text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
