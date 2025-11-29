<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { useUiStore, BOTTOM_BAR_TABS, type SidebarTabId } from '@/stores/uiStore'

const uiStore = useUiStore()

const activeBottomTab = computed(() => uiStore.activeBottomTab)
const bottomPanelExpanded = computed(() => uiStore.bottomPanelExpanded)

function handleTabClick(tabId: Exclude<SidebarTabId, null>): void {
  uiStore.toggleBottomTab(tabId)
}

// Mock data for panel content
const mockModels = [
  { name: 'SD 1.5', type: 'Checkpoint' },
  { name: 'SDXL Base', type: 'Checkpoint' },
  { name: 'Realistic Vision', type: 'Checkpoint' },
  { name: 'DreamShaper', type: 'LoRA' },
]

const mockWorkflows = [
  { name: 'Basic txt2img', date: '2024-01-15' },
  { name: 'Img2Img Pipeline', date: '2024-01-14' },
  { name: 'ControlNet Setup', date: '2024-01-13' },
]

const mockAssets = [
  { name: 'reference_01.png', type: 'image' },
  { name: 'mask_template.png', type: 'image' },
  { name: 'init_image.jpg', type: 'image' },
]

const mockTemplates = [
  { name: 'Text to Image (Basic)', category: 'Official', nodes: 6, color: '#64B5F6' },
  { name: 'Image to Image', category: 'Official', nodes: 8, color: '#64B5F6' },
  { name: 'SDXL + Refiner', category: 'SDXL', nodes: 14, color: '#B39DDB' },
  { name: 'SDXL Lightning', category: 'SDXL', nodes: 9, color: '#B39DDB' },
  { name: 'Canny Edge', category: 'ControlNet', nodes: 12, color: '#FFAB40' },
  { name: 'Depth Map', category: 'ControlNet', nodes: 12, color: '#FFAB40' },
]
</script>

<template>
  <div class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
    <!-- Expandable Panel (above tabs) -->
    <div
      v-if="bottomPanelExpanded"
      class="bottom-panel w-[600px] rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur"
    >
      <!-- Panel Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span class="text-sm font-medium text-zinc-300">
          {{ BOTTOM_BAR_TABS.find(t => t.id === activeBottomTab)?.label }}
        </span>
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          size="small"
          class="!h-6 !w-6"
          @click="uiStore.closeBottomPanel()"
        />
      </div>

      <!-- Search Box -->
      <div class="border-b border-zinc-800 p-3">
        <div class="flex items-center rounded-lg bg-zinc-800 px-3 py-2">
          <i class="pi pi-search text-sm text-zinc-500" />
          <input
            type="text"
            :placeholder="`Search ${BOTTOM_BAR_TABS.find(t => t.id === activeBottomTab)?.label?.toLowerCase()}...`"
            class="ml-2 w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-500"
          />
        </div>
      </div>

      <!-- Panel Content -->
      <div class="max-h-64 overflow-y-auto p-3">
        <!-- Models Tab -->
        <div v-if="activeBottomTab === 'models'" class="grid grid-cols-2 gap-2">
          <div
            v-for="model in mockModels"
            :key="model.name"
            class="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <div class="text-sm text-zinc-200">{{ model.name }}</div>
            <div class="text-xs text-zinc-500">{{ model.type }}</div>
          </div>
        </div>

        <!-- Workflows Tab -->
        <div v-else-if="activeBottomTab === 'workflows'" class="grid grid-cols-2 gap-2">
          <div
            v-for="workflow in mockWorkflows"
            :key="workflow.name"
            class="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <div class="text-sm text-zinc-200">{{ workflow.name }}</div>
            <div class="text-xs text-zinc-500">{{ workflow.date }}</div>
          </div>
        </div>

        <!-- Assets Tab -->
        <div v-else-if="activeBottomTab === 'assets'" class="grid grid-cols-3 gap-2">
          <div
            v-for="asset in mockAssets"
            :key="asset.name"
            class="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <div class="mb-2 flex h-16 items-center justify-center rounded bg-zinc-700">
              <i class="pi pi-image text-2xl text-zinc-500" />
            </div>
            <div class="truncate text-xs text-zinc-300">{{ asset.name }}</div>
          </div>
        </div>

        <!-- Templates Tab -->
        <div v-else-if="activeBottomTab === 'templates'" class="grid grid-cols-2 gap-2">
          <div
            v-for="template in mockTemplates"
            :key="template.name"
            class="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <div class="mb-2 flex items-center justify-between">
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                :style="{ backgroundColor: template.color + '20', color: template.color }"
              >
                {{ template.category }}
              </span>
              <span class="text-[10px] text-zinc-500">{{ template.nodes }} nodes</span>
            </div>
            <div class="text-sm text-zinc-200 group-hover:text-white">{{ template.name }}</div>
            <div class="mt-2 flex justify-end">
              <button class="flex h-6 w-6 items-center justify-center rounded bg-zinc-700 text-zinc-400 transition-colors hover:bg-blue-600 hover:text-white">
                <i class="pi pi-plus text-[10px]" />
              </button>
            </div>
          </div>
        </div>

        <!-- Library Tab -->
        <div v-else-if="activeBottomTab === 'library'" class="flex flex-col items-center justify-center py-8 text-zinc-500">
          <i class="pi pi-bookmark mb-2 text-3xl" />
          <span class="text-sm">Bookmarked items will appear here</span>
        </div>
      </div>
    </div>

    <!-- Bottom Tab Bar -->
    <div class="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/90 px-2 py-1.5 backdrop-blur">
      <!-- Tab buttons -->
      <button
        v-for="tab in BOTTOM_BAR_TABS"
        :key="tab.id"
        v-tooltip.top="{ value: tab.tooltip, showDelay: 300 }"
        class="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        :class="[
          activeBottomTab === tab.id
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        ]"
        @click="handleTabClick(tab.id)"
      >
        <i :class="[tab.icon, 'text-base']" />
      </button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
