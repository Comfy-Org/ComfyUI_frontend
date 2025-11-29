<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import { SidebarSearchBox, SidebarViewToggle, LibraryGridCard } from '@/components/common/sidebar'
import {
  TEAM_MEMBERS_DATA,
  BRAND_ASSETS_DATA,
  createSharedWorkflowsData,
  createTeamModelsData,
  NODE_PACKS_DATA,
} from '@/data/sidebarMockData'

interface LibraryItem {
  id: string
  name: string
  description?: string
  type: 'workflow' | 'model' | 'nodepack' | 'brand'
  subtype?: string
  thumbnail?: string
  icon: string
  iconClass: string
  badge?: string
  badgeClass?: string
  starred?: boolean
  meta?: string
}

defineProps<{
  teamName?: string
  teamLogo?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const searchQuery = ref('')
const viewMode = ref<'list' | 'grid'>('grid')
const sortBy = ref('name')
const showFilterMenu = ref(false)
const showSortMenu = ref(false)
const activeFilters = ref<Set<string>>(new Set())

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Recently Added', value: 'recent' },
]

const filterOptions = [
  { label: 'Workflows', value: 'workflow', icon: 'pi pi-sitemap', color: 'text-blue-400' },
  { label: 'Models', value: 'model', icon: 'pi pi-box', color: 'text-green-400' },
  { label: 'Nodepacks', value: 'nodepack', icon: 'pi pi-code', color: 'text-purple-400' },
  { label: 'Brand Kit', value: 'brand', icon: 'pi pi-palette', color: 'text-amber-400' },
]

function setSort(value: string): void {
  sortBy.value = value
  showSortMenu.value = false
}

function toggleFilter(value: string): void {
  const newFilters = new Set(activeFilters.value)
  if (newFilters.has(value)) {
    newFilters.delete(value)
  } else {
    newFilters.add(value)
  }
  activeFilters.value = newFilters
}

function clearFilters(): void {
  activeFilters.value = new Set()
}

const filterLabel = computed(() => {
  if (activeFilters.value.size === 0) return 'All'
  if (activeFilters.value.size === 1) {
    const value = [...activeFilters.value][0]
    return filterOptions.find(o => o.value === value)?.label || 'All'
  }
  return `${activeFilters.value.size} selected`
})

// Combine all items into a unified list
const allItems = computed<LibraryItem[]>(() => {
  const items: LibraryItem[] = []

  // Add workflows
  const workflows = createSharedWorkflowsData(TEAM_MEMBERS_DATA)
  workflows.forEach(w => {
    items.push({
      id: `workflow-${w.id}`,
      name: w.name,
      description: w.description,
      type: 'workflow',
      thumbnail: w.thumbnail,
      icon: 'pi pi-sitemap',
      iconClass: 'text-blue-400',
      badge: `${w.nodes} nodes`,
      badgeClass: 'bg-blue-500/30 text-blue-300',
      starred: w.starred,
      meta: w.updatedAt,
    })
  })

  // Add models
  const models = createTeamModelsData(TEAM_MEMBERS_DATA)
  models.forEach(m => {
    const typeLabels: Record<string, string> = {
      checkpoint: 'Checkpoint',
      lora: 'LoRA',
      embedding: 'Embedding',
      controlnet: 'ControlNet',
    }
    const typeColors: Record<string, string> = {
      checkpoint: 'bg-purple-500/30 text-purple-300',
      lora: 'bg-green-500/30 text-green-300',
      embedding: 'bg-amber-500/30 text-amber-300',
      controlnet: 'bg-cyan-500/30 text-cyan-300',
    }
    items.push({
      id: `model-${m.id}`,
      name: m.name,
      description: m.description,
      type: 'model',
      subtype: m.type,
      thumbnail: m.thumbnail,
      icon: 'pi pi-box',
      iconClass: 'text-green-400',
      badge: typeLabels[m.type] || m.type,
      badgeClass: typeColors[m.type] || 'bg-zinc-700 text-zinc-400',
      meta: m.size,
    })
  })

  // Add nodepacks
  NODE_PACKS_DATA.forEach(p => {
    items.push({
      id: `nodepack-${p.id}`,
      name: p.name,
      description: p.description,
      type: 'nodepack',
      thumbnail: p.thumbnail,
      icon: 'pi pi-code',
      iconClass: 'text-purple-400',
      badge: p.installed ? 'Installed' : `${p.nodes} nodes`,
      badgeClass: p.installed ? 'bg-green-500/30 text-green-300' : 'bg-zinc-700 text-zinc-400',
      meta: `v${p.version}`,
    })
  })

  // Add brand assets (excluding colors)
  BRAND_ASSETS_DATA.filter(a => a.type !== 'color').forEach(a => {
    const typeLabels: Record<string, string> = {
      logo: 'Logo',
      font: 'Font',
      template: 'Template',
      guideline: 'Guide',
    }
    items.push({
      id: `brand-${a.id}`,
      name: a.name,
      description: a.description,
      type: 'brand',
      subtype: a.type,
      icon: a.type === 'logo' ? 'pi pi-image' : a.type === 'font' ? 'pi pi-align-left' : a.type === 'template' ? 'pi pi-clone' : 'pi pi-book',
      iconClass: 'text-amber-400',
      badge: typeLabels[a.type] || a.type,
      badgeClass: 'bg-amber-500/30 text-amber-300',
    })
  })

  return items
})

// Filter and search
const filteredItems = computed(() => {
  let items = allItems.value

  // Apply type filters (multi-select)
  if (activeFilters.value.size > 0) {
    items = items.filter(i => activeFilters.value.has(i.type))
  }

  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(i =>
      i.name.toLowerCase().includes(query) ||
      i.description?.toLowerCase().includes(query)
    )
  }

  // Apply sort
  if (sortBy.value === 'name') {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name))
  }

  return items
})
</script>

<template>
  <div class="flex h-full w-80 flex-col">
    <!-- Panel Header -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        TEAM LIBRARY
      </span>
      <div class="flex items-center gap-1">
        <Button
          icon="pi pi-window-maximize"
          text
          severity="secondary"
          size="small"
          class="!h-6 !w-6"
          v-tooltip.top="'Expand'"
        />
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          size="small"
          class="!h-6 !w-6"
          @click="emit('close')"
        />
      </div>
    </div>

    <!-- Search & Controls -->
    <div class="border-b border-zinc-800 p-2">
      <SidebarSearchBox
        v-model="searchQuery"
        placeholder="Search library..."
        :show-action="true"
        action-tooltip="Manage Library"
        action-icon="pi pi-cog"
      />

      <!-- View Controls -->
      <div class="mt-2 flex items-center justify-between">
        <SidebarViewToggle v-model="viewMode" />

        <!-- Filter & Sort -->
        <div class="flex items-center gap-1">
          <!-- Filter Dropdown -->
          <div class="relative">
            <button
              :class="[
                'flex h-6 items-center gap-1 rounded px-2 text-[10px] transition-colors',
                activeFilters.size > 0
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              ]"
              @click="showFilterMenu = !showFilterMenu"
            >
              <i class="pi pi-filter text-[10px]" />
              <span>{{ filterLabel }}</span>
              <i class="pi pi-chevron-down text-[8px]" />
            </button>
            <div
              v-if="showFilterMenu"
              class="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-zinc-700 bg-black py-1 shadow-xl"
            >
              <!-- Clear all -->
              <button
                v-if="activeFilters.size > 0"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                @click="clearFilters"
              >
                <i class="pi pi-times text-[10px]" />
                Clear all
              </button>
              <div v-if="activeFilters.size > 0" class="mx-2 my-1 h-px bg-zinc-800" />
              <!-- Filter options -->
              <button
                v-for="option in filterOptions"
                :key="option.value"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-zinc-800"
                @click="toggleFilter(option.value)"
              >
                <div
                  :class="[
                    'flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors',
                    activeFilters.has(option.value)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-zinc-600 bg-transparent'
                  ]"
                >
                  <i v-if="activeFilters.has(option.value)" class="pi pi-check text-[8px] text-white" />
                </div>
                <i :class="[option.icon, 'text-[10px]', option.color]" />
                <span :class="activeFilters.has(option.value) ? 'text-zinc-200' : 'text-zinc-400'">
                  {{ option.label }}
                </span>
              </button>
            </div>
          </div>

          <!-- Sort Dropdown -->
          <div class="relative">
            <button
              class="flex h-6 items-center gap-1 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              @click="showSortMenu = !showSortMenu"
            >
              <i class="pi pi-sort-alt text-[10px]" />
              <span>{{ sortOptions.find(o => o.value === sortBy)?.label }}</span>
              <i class="pi pi-chevron-down text-[8px]" />
            </button>
            <div
              v-if="showSortMenu"
              class="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-zinc-700 bg-black py-1 shadow-xl"
            >
              <button
                v-for="option in sortOptions"
                :key="option.value"
                class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
                :class="sortBy === option.value ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
                @click="setSort(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Empty State -->
      <div
        v-if="filteredItems.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center"
      >
        <i class="pi pi-inbox mb-2 text-2xl text-zinc-600" />
        <p class="text-xs text-zinc-500">No items found</p>
      </div>

      <!-- List View -->
      <div v-else-if="viewMode === 'list'" class="select-none space-y-0.5">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
          draggable="true"
        >
          <i :class="[item.icon, 'text-xs', item.iconClass]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-xs text-zinc-300 group-hover:text-zinc-100">{{ item.name }}</span>
              <i v-if="item.starred" class="pi pi-star-fill text-[8px] text-amber-400" />
            </div>
            <div class="flex items-center gap-2 text-[10px] text-zinc-600">
              <span v-if="item.badge" :class="['rounded px-1 py-0.5 text-[9px]', item.badgeClass]">
                {{ item.badge }}
              </span>
              <span v-if="item.meta">{{ item.meta }}</span>
            </div>
          </div>
          <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>

      <!-- Grid View -->
      <div v-else class="grid grid-cols-1 gap-2">
        <LibraryGridCard
          v-for="item in filteredItems"
          :key="item.id"
          :title="item.name"
          :subtitle="item.meta"
          :thumbnail="item.thumbnail"
          :icon="item.icon"
          :icon-class="item.iconClass"
          :badge="item.badge"
          :badge-class="item.badgeClass"
          :starred="item.starred"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
div::-webkit-scrollbar {
  width: 4px;
}

div::-webkit-scrollbar-track {
  background: transparent;
}

div::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 2px;
}

div::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}
</style>
