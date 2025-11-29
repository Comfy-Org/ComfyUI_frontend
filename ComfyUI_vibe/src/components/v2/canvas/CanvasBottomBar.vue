<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import { useUiStore, BOTTOM_BAR_TABS, type SidebarTabId } from '@/stores/uiStore'

const uiStore = useUiStore()

const activeBottomTab = computed(() => uiStore.activeBottomTab)
const bottomPanelExpanded = computed(() => uiStore.bottomPanelExpanded)

// Panel state
const searchQuery = ref('')
const activeFilter = ref('all')
const isExtended = ref(false)
const showSidebar = ref(true)

function handleTabClick(tabId: Exclude<SidebarTabId, null>): void {
  uiStore.toggleBottomTab(tabId)
}

// Filter tabs based on active tab
const filterTabs = computed(() => {
  switch (activeBottomTab.value) {
    case 'models':
      return ['All', 'Checkpoints', 'LoRA', 'VAE', 'Embeddings']
    case 'workflows':
      return ['All', 'Recent', 'Favorites', 'Shared']
    case 'assets':
      return ['All', 'Images', 'Masks', 'Videos']
    case 'templates':
      return ['All', 'Official', 'SDXL', 'ControlNet', 'Video', 'Community']
    case 'packages':
      return ['All', 'Installed', 'Updates', 'Popular']
    default:
      return ['All']
  }
})

// Sidebar categories based on active tab
const sidebarCategories = computed(() => {
  switch (activeBottomTab.value) {
    case 'models':
      return [
        { id: 'checkpoints', label: 'Checkpoints', icon: 'pi-box', count: 12 },
        { id: 'lora', label: 'LoRA', icon: 'pi-bolt', count: 24 },
        { id: 'vae', label: 'VAE', icon: 'pi-sliders-h', count: 3 },
        { id: 'embeddings', label: 'Embeddings', icon: 'pi-tag', count: 8 },
        { id: 'controlnet', label: 'ControlNet', icon: 'pi-sitemap', count: 6 },
        { id: 'upscalers', label: 'Upscalers', icon: 'pi-arrow-up-right', count: 4 },
      ]
    case 'workflows':
      return [
        { id: 'recent', label: 'Recent', icon: 'pi-clock', count: 8 },
        { id: 'favorites', label: 'Favorites', icon: 'pi-star', count: 5 },
        { id: 'shared', label: 'Shared with me', icon: 'pi-users', count: 3 },
        { id: 'templates', label: 'From Templates', icon: 'pi-copy', count: 12 },
      ]
    case 'assets':
      return [
        { id: 'images', label: 'Images', icon: 'pi-image', count: 45 },
        { id: 'masks', label: 'Masks', icon: 'pi-circle', count: 8 },
        { id: 'videos', label: 'Videos', icon: 'pi-video', count: 3 },
        { id: 'audio', label: 'Audio', icon: 'pi-volume-up', count: 2 },
      ]
    case 'templates':
      return [
        { id: 'official', label: 'Official', icon: 'pi-verified', count: 15 },
        { id: 'sdxl', label: 'SDXL', icon: 'pi-star', count: 8 },
        { id: 'controlnet', label: 'ControlNet', icon: 'pi-sitemap', count: 12 },
        { id: 'video', label: 'Video', icon: 'pi-video', count: 6 },
        { id: 'community', label: 'Community', icon: 'pi-users', count: 42 },
      ]
    case 'packages':
      return [
        { id: 'installed', label: 'Installed', icon: 'pi-check-circle', count: 8 },
        { id: 'updates', label: 'Updates', icon: 'pi-refresh', count: 2 },
        { id: 'popular', label: 'Popular', icon: 'pi-chart-line', count: 50 },
        { id: 'new', label: 'New', icon: 'pi-sparkles', count: 12 },
      ]
    default:
      return []
  }
})

// Mock data for panel content
const mockModels = [
  { name: 'SD 1.5', type: 'Checkpoint', size: '4.2 GB', updated: '2 days ago' },
  { name: 'SDXL Base', type: 'Checkpoint', size: '6.9 GB', updated: '1 week ago' },
  { name: 'Realistic Vision v5.1', type: 'Checkpoint', size: '4.1 GB', updated: '3 days ago' },
  { name: 'DreamShaper v8', type: 'Checkpoint', size: '4.2 GB', updated: '5 days ago' },
  { name: 'Detail Tweaker LoRA', type: 'LoRA', size: '144 MB', updated: '1 day ago' },
  { name: 'epiNoiseoffset', type: 'LoRA', size: '151 MB', updated: '4 days ago' },
  { name: 'Juggernaut XL', type: 'Checkpoint', size: '6.5 GB', updated: '1 day ago' },
  { name: 'Flat2D Anime', type: 'LoRA', size: '220 MB', updated: '3 days ago' },
]

const mockWorkflows = [
  { name: 'Basic txt2img', date: '2024-01-15', nodes: 6, author: 'You' },
  { name: 'Img2Img Pipeline', date: '2024-01-14', nodes: 8, author: 'You' },
  { name: 'ControlNet Setup', date: '2024-01-13', nodes: 12, author: 'You' },
  { name: 'Upscale Workflow', date: '2024-01-12', nodes: 5, author: 'You' },
  { name: 'AnimateDiff Motion', date: '2024-01-11', nodes: 18, author: 'You' },
  { name: 'Inpainting Pro', date: '2024-01-10', nodes: 10, author: 'You' },
]

const mockAssets = [
  { name: 'reference_01.png', type: 'image', size: '2.4 MB' },
  { name: 'mask_template.png', type: 'image', size: '156 KB' },
  { name: 'init_image.jpg', type: 'image', size: '1.8 MB' },
  { name: 'depth_map.png', type: 'image', size: '512 KB' },
  { name: 'controlnet_pose.png', type: 'image', size: '890 KB' },
  { name: 'background.jpg', type: 'image', size: '3.2 MB' },
  { name: 'style_ref.png', type: 'image', size: '1.1 MB' },
  { name: 'sketch_input.png', type: 'image', size: '420 KB' },
]

const mockTemplates = [
  { name: 'Text to Image (Basic)', category: 'Official', nodes: 6, color: '#64B5F6', desc: 'Simple text-to-image workflow' },
  { name: 'Image to Image', category: 'Official', nodes: 8, color: '#64B5F6', desc: 'Transform existing images' },
  { name: 'SDXL + Refiner', category: 'SDXL', nodes: 14, color: '#B39DDB', desc: 'High-quality SDXL generation' },
  { name: 'SDXL Lightning', category: 'SDXL', nodes: 9, color: '#B39DDB', desc: 'Fast SDXL generation' },
  { name: 'Canny Edge', category: 'ControlNet', nodes: 12, color: '#FFAB40', desc: 'Edge-guided generation' },
  { name: 'Depth Map', category: 'ControlNet', nodes: 12, color: '#FFAB40', desc: 'Depth-guided generation' },
  { name: 'AnimateDiff Basic', category: 'Video', nodes: 18, color: '#81C784', desc: 'Simple animation workflow' },
  { name: 'Community Upscaler', category: 'Community', nodes: 7, color: '#F48FB1', desc: 'Enhanced upscaling' },
  { name: 'Face Restore', category: 'Official', nodes: 5, color: '#64B5F6', desc: 'Restore faces in images' },
]

const mockPackages = [
  { name: 'ComfyUI-Manager', author: 'ltdrdata', version: '2.1.0', nodes: 15, installed: true, desc: 'Package manager for ComfyUI' },
  { name: 'ComfyUI-Impact-Pack', author: 'ltdrdata', version: '4.5.2', nodes: 45, installed: true, desc: 'Detection and segmentation' },
  { name: 'ComfyUI-Controlnet-Aux', author: 'Fannovel16', version: '1.2.0', nodes: 28, installed: true, desc: 'ControlNet preprocessors' },
  { name: 'ComfyUI-AnimateDiff', author: 'Kosinkadink', version: '0.9.1', nodes: 12, installed: false, desc: 'Animation generation' },
  { name: 'ComfyUI-VideoHelperSuite', author: 'Kosinkadink', version: '1.0.0', nodes: 8, installed: false, desc: 'Video processing tools' },
]

const mockRecents = [
  { name: 'Upscale 4x', type: 'action', icon: 'pi-arrow-up-right' },
  { name: 'SDXL Base', type: 'model', icon: 'pi-box' },
  { name: 'Basic txt2img', type: 'workflow', icon: 'pi-share-alt' },
]
</script>

<template>
  <div class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
    <!-- Expandable Panel (above tabs) -->
    <div
      v-if="bottomPanelExpanded"
      class="bottom-panel flex overflow-hidden rounded-xl border border-zinc-800 bg-black/95 shadow-2xl backdrop-blur transition-all duration-300"
      :style="{
        width: isExtended ? 'calc(100vw - 100px)' : '720px',
        maxWidth: isExtended ? '1400px' : '720px',
        height: isExtended ? 'calc(100vh - 200px)' : 'auto',
        maxHeight: isExtended ? '800px' : 'none'
      }"
    >
      <!-- Left Sidebar -->
      <div
        v-if="showSidebar"
        class="flex w-48 shrink-0 flex-col border-r border-zinc-800 bg-black/50"
      >
        <div class="p-3">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Categories</div>
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-3">
          <button
            v-for="cat in sidebarCategories"
            :key="cat.id"
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-zinc-800"
            :class="activeFilter === cat.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'"
            @click="activeFilter = cat.id"
          >
            <i :class="['pi', cat.icon, 'text-[11px]']" />
            <span class="flex-1 truncate">{{ cat.label }}</span>
            <span class="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-500">{{ cat.count }}</span>
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex flex-1 flex-col min-w-0">
        <!-- Panel Header -->
        <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <div class="flex items-center gap-2">
            <!-- Sidebar toggle -->
            <button
              class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
              :class="showSidebar ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
              v-tooltip.top="showSidebar ? 'Hide sidebar' : 'Show sidebar'"
              @click="showSidebar = !showSidebar"
            >
              <i class="pi pi-bars text-xs" />
            </button>
            <div class="h-4 w-px bg-zinc-700" />
            <span class="text-sm font-medium text-zinc-200">
              {{ BOTTOM_BAR_TABS.find(t => t.id === activeBottomTab)?.label }}
            </span>
            <!-- Scan/Refresh action -->
            <button
              v-if="activeBottomTab === 'models' || activeBottomTab === 'packages'"
              class="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            >
              <i class="pi pi-sync text-[10px]" />
              Scan
            </button>
          </div>
          <div class="flex items-center gap-1">
            <!-- View toggle -->
            <button
              class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              v-tooltip.top="'Grid view'"
            >
              <i class="pi pi-th-large text-xs" />
            </button>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              v-tooltip.top="'List view'"
            >
              <i class="pi pi-list text-xs" />
            </button>
            <div class="mx-1 h-4 w-px bg-zinc-700" />
            <button
              class="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
              :class="isExtended ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
              v-tooltip.top="isExtended ? 'Collapse' : 'Expand'"
              @click="isExtended = !isExtended"
            >
              <i :class="['pi text-xs', isExtended ? 'pi-window-minimize' : 'pi-window-maximize']" />
            </button>
            <Button
              icon="pi pi-times"
              text
              severity="secondary"
              size="small"
              class="!h-7 !w-7"
              @click="uiStore.closeBottomPanel()"
            />
          </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
          <!-- Search -->
          <div class="flex flex-1 items-center rounded-lg bg-zinc-800 px-3 py-2">
            <i class="pi pi-search text-sm text-zinc-500" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="`Search ${BOTTOM_BAR_TABS.find(t => t.id === activeBottomTab)?.label?.toLowerCase()}...`"
              class="ml-2 w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-500"
            />
            <kbd v-if="!searchQuery" class="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">⌘K</kbd>
          </div>

          <!-- Sort dropdown -->
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-zinc-500">Sort:</span>
            <button class="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700">
              Recent
              <i class="pi pi-chevron-down text-[10px] text-zinc-500" />
            </button>
          </div>
        </div>

        <!-- Filter Tabs (only show if sidebar is hidden) -->
        <div v-if="!showSidebar" class="flex items-center gap-1 border-b border-zinc-800 px-4 py-2">
          <button
            v-for="filter in filterTabs"
            :key="filter"
            class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="[
              activeFilter === filter.toLowerCase()
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            ]"
            @click="activeFilter = filter.toLowerCase()"
          >
            {{ filter }}
          </button>
        </div>

        <!-- Recents Row (for some tabs) -->
        <div v-if="(activeBottomTab === 'models' || activeBottomTab === 'workflows') && !isExtended" class="border-b border-zinc-800 px-4 py-2.5">
          <div class="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Recents</div>
          <div class="flex items-center gap-2">
            <button
              v-for="recent in mockRecents"
              :key="recent.name"
              class="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <i :class="['pi', recent.icon, 'text-[10px] text-zinc-500']" />
              {{ recent.name }}
            </button>
          </div>
        </div>

        <!-- Panel Content -->
        <div
          class="flex-1 overflow-y-auto p-4"
          :style="{ maxHeight: isExtended ? 'none' : '400px' }"
        >
          <!-- Unified Grid for all content tabs -->
          <div
            v-if="activeBottomTab !== 'library'"
            class="grid gap-3"
            :class="isExtended ? 'grid-cols-6' : 'grid-cols-4'"
          >
            <!-- Models Cards -->
            <template v-if="activeBottomTab === 'models'">
              <div
                v-for="model in mockModels"
                :key="model.name"
                class="card-item group"
              >
                <div class="card-preview">
                  <i class="pi pi-box text-2xl text-zinc-500" />
                  <button class="card-menu">
                    <i class="pi pi-ellipsis-v text-[10px]" />
                  </button>
                  <span class="card-badge">{{ model.type }}</span>
                </div>
                <div class="card-info">
                  <div class="card-title">{{ model.name }}</div>
                  <div class="card-meta">{{ model.size }}</div>
                </div>
              </div>
            </template>

            <!-- Workflows Cards -->
            <template v-else-if="activeBottomTab === 'workflows'">
              <div
                v-for="workflow in mockWorkflows"
                :key="workflow.name"
                class="card-item group"
              >
                <div class="card-preview">
                  <i class="pi pi-share-alt text-2xl text-zinc-500" />
                  <button class="card-menu">
                    <i class="pi pi-ellipsis-v text-[10px]" />
                  </button>
                  <span class="card-badge">{{ workflow.nodes }} nodes</span>
                </div>
                <div class="card-info">
                  <div class="card-title">{{ workflow.name }}</div>
                  <div class="card-meta">{{ workflow.date }}</div>
                </div>
              </div>
            </template>

            <!-- Assets Cards -->
            <template v-else-if="activeBottomTab === 'assets'">
              <div
                v-for="asset in mockAssets"
                :key="asset.name"
                class="card-item group"
              >
                <div class="card-preview">
                  <i class="pi pi-image text-2xl text-zinc-500" />
                  <button class="card-menu">
                    <i class="pi pi-ellipsis-v text-[10px]" />
                  </button>
                </div>
                <div class="card-info">
                  <div class="card-title">{{ asset.name }}</div>
                  <div class="card-meta">{{ asset.size }}</div>
                </div>
              </div>
            </template>

            <!-- Templates Cards -->
            <template v-else-if="activeBottomTab === 'templates'">
              <div
                v-for="template in mockTemplates"
                :key="template.name"
                class="card-item group"
              >
                <div class="card-preview">
                  <i class="pi pi-copy text-2xl text-zinc-500" />
                  <button class="card-menu">
                    <i class="pi pi-ellipsis-v text-[10px]" />
                  </button>
                  <span
                    class="card-badge"
                    :style="{ backgroundColor: template.color + '30', color: template.color }"
                  >
                    {{ template.category }}
                  </span>
                </div>
                <div class="card-info">
                  <div class="card-title">{{ template.name }}</div>
                  <div class="card-meta">{{ template.nodes }} nodes</div>
                </div>
              </div>
            </template>

            <!-- Packages Cards -->
            <template v-else-if="activeBottomTab === 'packages'">
              <div
                v-for="pkg in mockPackages"
                :key="pkg.name"
                class="card-item group"
              >
                <div class="card-preview">
                  <i class="pi pi-th-large text-2xl text-zinc-500" />
                  <button class="card-menu">
                    <i class="pi pi-ellipsis-v text-[10px]" />
                  </button>
                  <span
                    v-if="pkg.installed"
                    class="card-badge bg-green-500/20 text-green-400"
                  >
                    Installed
                  </span>
                </div>
                <div class="card-info">
                  <div class="card-title">{{ pkg.name }}</div>
                  <div class="card-meta">{{ pkg.author }} · v{{ pkg.version }}</div>
                </div>
              </div>
            </template>
          </div>

          <!-- Library Tab - Empty State -->
          <div v-else class="flex flex-col items-center justify-center py-12 text-zinc-500">
            <i class="pi pi-bookmark mb-3 text-4xl" />
            <span class="text-sm font-medium">No bookmarks yet</span>
            <span class="mt-1 text-xs text-zinc-600">Bookmarked items will appear here</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Tab Bar -->
    <div class="flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/90 px-2 py-1.5 backdrop-blur">
      <!-- Tab buttons -->
      <button
        v-for="tab in BOTTOM_BAR_TABS"
        :key="tab.id"
        v-tooltip.top="{ value: tab.tooltip, showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        :class="[
          activeBottomTab === tab.id
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        ]"
        @click="handleTabClick(tab.id)"
      >
        <i :class="[tab.icon, 'text-base']" />
      </button>

      <!-- Divider -->
      <div class="mx-1 h-5 w-px bg-zinc-700" />

      <!-- Settings & Shortcuts -->
      <button
        v-tooltip.top="{ value: 'Keyboard Shortcuts', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <i class="pi pi-bolt text-base" />
      </button>
      <button
        v-tooltip.top="{ value: 'Settings', showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <i class="pi pi-cog text-base" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "@/assets/css/main.css";

.bottom-panel {
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Standardized Card Styles */
.card-item {
  @apply cursor-pointer rounded-lg border border-zinc-800 bg-zinc-800/30 p-2 transition-all;
  @apply hover:border-zinc-600 hover:bg-zinc-800/70;
}

.card-preview {
  @apply relative flex aspect-square items-center justify-center rounded-md bg-zinc-700/50;
  @apply transition-all group-hover:bg-zinc-700;
}

.card-menu {
  @apply absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md;
  @apply bg-zinc-900/70 text-zinc-400 opacity-0 transition-all;
  @apply hover:bg-zinc-900 hover:text-zinc-200 group-hover:opacity-100;
}

.card-badge {
  @apply absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5;
  @apply bg-zinc-900/70 text-[10px] font-medium text-zinc-300;
}

.card-info {
  @apply mt-2 min-w-0;
}

.card-title {
  @apply truncate text-xs font-medium text-zinc-200;
}

.card-meta {
  @apply truncate text-[10px] text-zinc-500;
}
</style>
