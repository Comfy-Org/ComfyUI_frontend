<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import { SidebarSearchBox, SidebarViewToggle, LibraryGridCard } from '@/components/common/sidebar'

interface AssetItem {
  id: string
  name: string
  type: 'image' | 'video' | 'audio' | 'mask' | '3d'
  size: string
  dimensions?: string
  thumbnail?: string
  icon: string
  iconClass: string
  badge?: string
  badgeClass?: string
  updatedAt: string
}

const emit = defineEmits<{
  close: []
}>()

const searchQuery = ref('')
const viewMode = ref<'list' | 'grid'>('grid')
const sortBy = ref('recent')
const showFilterMenu = ref(false)
const showSortMenu = ref(false)
const activeFilters = ref<Set<string>>(new Set())

const sortOptions = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Size', value: 'size' },
]

const filterOptions = [
  { label: 'Images', value: 'image', icon: 'pi pi-image', color: 'text-blue-400' },
  { label: 'Videos', value: 'video', icon: 'pi pi-video', color: 'text-purple-400' },
  { label: 'Audio', value: 'audio', icon: 'pi pi-volume-up', color: 'text-green-400' },
  { label: 'Masks', value: 'mask', icon: 'pi pi-circle', color: 'text-amber-400' },
  { label: '3D', value: '3d', icon: 'pi pi-box', color: 'text-cyan-400' },
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

// Mock assets data
const allAssets = computed<AssetItem[]>(() => [
  { id: '1', name: 'reference_portrait.png', type: 'image', size: '2.4 MB', dimensions: '1024x1024', thumbnail: '/assets/card_images/workflow_01.webp', icon: 'pi pi-image', iconClass: 'text-blue-400', badge: 'PNG', badgeClass: 'bg-blue-500/30 text-blue-300', updatedAt: '2 hours ago' },
  { id: '2', name: 'depth_map_01.png', type: 'mask', size: '512 KB', dimensions: '512x512', thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp', icon: 'pi pi-circle', iconClass: 'text-amber-400', badge: 'Mask', badgeClass: 'bg-amber-500/30 text-amber-300', updatedAt: '1 day ago' },
  { id: '3', name: 'hero_background.jpg', type: 'image', size: '3.8 MB', dimensions: '1920x1080', thumbnail: '/assets/card_images/bacb46ea-7e63-4f19-a253-daf41461e98f.webp', icon: 'pi pi-image', iconClass: 'text-blue-400', badge: 'JPG', badgeClass: 'bg-blue-500/30 text-blue-300', updatedAt: '3 days ago' },
  { id: '4', name: 'animation_loop.mp4', type: 'video', size: '12.5 MB', dimensions: '1080x1920', thumbnail: '/assets/card_images/228616f4-12ad-426d-84fb-f20e488ba7ee.webp', icon: 'pi pi-video', iconClass: 'text-purple-400', badge: 'MP4', badgeClass: 'bg-purple-500/30 text-purple-300', updatedAt: '1 week ago' },
  { id: '5', name: 'controlnet_pose.png', type: 'mask', size: '890 KB', dimensions: '768x1024', thumbnail: '/assets/card_images/683255d3-1d10-43d9-a6ff-ef142061e88a.webp', icon: 'pi pi-circle', iconClass: 'text-amber-400', badge: 'Pose', badgeClass: 'bg-amber-500/30 text-amber-300', updatedAt: '2 days ago' },
  { id: '6', name: 'product_shot.png', type: 'image', size: '1.8 MB', dimensions: '2048x2048', thumbnail: '/assets/card_images/91f1f589-ddb4-4c4f-b3a7-ba30fc271987.webp', icon: 'pi pi-image', iconClass: 'text-blue-400', badge: 'PNG', badgeClass: 'bg-blue-500/30 text-blue-300', updatedAt: '5 days ago' },
  { id: '7', name: 'ambient_audio.wav', type: 'audio', size: '4.2 MB', icon: 'pi pi-volume-up', iconClass: 'text-green-400', badge: 'WAV', badgeClass: 'bg-green-500/30 text-green-300', updatedAt: '1 week ago' },
  { id: '8', name: 'canny_edges.png', type: 'mask', size: '320 KB', dimensions: '1024x1024', thumbnail: '/assets/card_images/28e9f7ea-ef00-48e8-849d-8752a34939c7.webp', icon: 'pi pi-circle', iconClass: 'text-amber-400', badge: 'Canny', badgeClass: 'bg-amber-500/30 text-amber-300', updatedAt: '4 days ago' },
  { id: '9', name: 'style_reference.webp', type: 'image', size: '680 KB', dimensions: '512x768', thumbnail: '/assets/card_images/comfyui_workflow.jpg', icon: 'pi pi-image', iconClass: 'text-blue-400', badge: 'WEBP', badgeClass: 'bg-blue-500/30 text-blue-300', updatedAt: '6 days ago' },
  { id: '10', name: 'promo_video.mp4', type: 'video', size: '28.4 MB', dimensions: '1920x1080', thumbnail: '/assets/card_images/dda28581-37c8-44da-8822-57d1ccc2118c_2130x1658.png', icon: 'pi pi-video', iconClass: 'text-purple-400', badge: 'MP4', badgeClass: 'bg-purple-500/30 text-purple-300', updatedAt: '2 weeks ago' },
])

// Filter and search
const filteredAssets = computed(() => {
  let items = allAssets.value

  // Apply type filters (multi-select)
  if (activeFilters.value.size > 0) {
    items = items.filter(i => activeFilters.value.has(i.type))
  }

  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(i => i.name.toLowerCase().includes(query))
  }

  // Apply sort
  if (sortBy.value === 'name') {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'size') {
    items = [...items].sort((a, b) => {
      const sizeA = parseFloat(a.size)
      const sizeB = parseFloat(b.size)
      return sizeB - sizeA
    })
  }

  return items
})
</script>

<template>
  <div class="flex h-full w-80 flex-col">
    <!-- Panel Header -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        ASSETS
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
        placeholder="Search assets..."
        :show-action="true"
        action-tooltip="Upload Asset"
        action-icon="pi pi-upload"
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
              class="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-zinc-700 bg-black py-1 shadow-xl"
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
              class="absolute right-0 top-full z-50 mt-1 min-w-[100px] rounded-lg border border-zinc-700 bg-black py-1 shadow-xl"
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
        v-if="filteredAssets.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center"
      >
        <i class="pi pi-images mb-2 text-2xl text-zinc-600" />
        <p class="text-xs text-zinc-500">No assets found</p>
      </div>

      <!-- List View -->
      <div v-else-if="viewMode === 'list'" class="select-none space-y-0.5">
        <div
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
          draggable="true"
        >
          <i :class="[asset.icon, 'text-xs', asset.iconClass]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-xs text-zinc-300 group-hover:text-zinc-100">{{ asset.name }}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-zinc-600">
              <span v-if="asset.badge" :class="['rounded px-1 py-0.5 text-[9px]', asset.badgeClass]">
                {{ asset.badge }}
              </span>
              <span>{{ asset.size }}</span>
              <span v-if="asset.dimensions">{{ asset.dimensions }}</span>
            </div>
          </div>
          <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>

      <!-- Grid View -->
      <div v-else class="grid grid-cols-1 gap-2">
        <LibraryGridCard
          v-for="asset in filteredAssets"
          :key="asset.id"
          :title="asset.name"
          :subtitle="`${asset.size}${asset.dimensions ? ' · ' + asset.dimensions : ''}`"
          :thumbnail="asset.thumbnail"
          :icon="asset.icon"
          :icon-class="asset.iconClass"
          :badge="asset.badge"
          :badge-class="asset.badgeClass"
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
