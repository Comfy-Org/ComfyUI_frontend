<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import {
  useUiStore,
  NODE_CATEGORIES,
  SIDEBAR_TABS,
  type NodeCategoryId,
  type SidebarTabId
} from '@/stores/uiStore'

const uiStore = useUiStore()

// Interface version
const isV2 = computed(() => uiStore.interfaceVersion === 'v2')

// V2: Node category state
const activeNodeCategory = computed(() => uiStore.activeNodeCategory)
const activeNodeCategoryData = computed(() => uiStore.activeNodeCategoryData)
const nodePanelExpanded = computed(() => uiStore.nodePanelExpanded)

// V1: Legacy sidebar tab state
const activeSidebarTab = computed(() => uiStore.activeSidebarTab)
const sidebarPanelExpanded = computed(() => uiStore.sidebarPanelExpanded)

const searchQuery = ref('')

// V1: View controls
const viewMode = ref<'list' | 'grid'>('list')
const sortBy = ref('name')
const showFilterMenu = ref(false)
const showSortMenu = ref(false)

// Sort options per tab
const sortOptions = computed(() => {
  switch (activeSidebarTab.value) {
    case 'nodes':
      return [
        { label: 'Name', value: 'name' },
        { label: 'Category', value: 'category' },
        { label: 'Recently Used', value: 'recent' },
      ]
    case 'models':
      return [
        { label: 'Name', value: 'name' },
        { label: 'Type', value: 'type' },
        { label: 'Size', value: 'size' },
        { label: 'Date Added', value: 'date' },
      ]
    case 'workflows':
      return [
        { label: 'Name', value: 'name' },
        { label: 'Date Modified', value: 'date' },
        { label: 'Node Count', value: 'nodes' },
      ]
    case 'assets':
      return [
        { label: 'Name', value: 'name' },
        { label: 'Type', value: 'type' },
        { label: 'Date Added', value: 'date' },
      ]
    default:
      return [{ label: 'Name', value: 'name' }]
  }
})

// Filter options per tab
const filterOptions = computed(() => {
  switch (activeSidebarTab.value) {
    case 'nodes':
      return ['All', 'Core', 'Custom', 'Favorites']
    case 'models':
      return ['All', 'Checkpoints', 'LoRAs', 'VAE', 'ControlNet', 'Embeddings']
    case 'workflows':
      return ['All', 'Recent', 'Favorites', 'Shared']
    case 'assets':
      return ['All', 'Images', 'Masks', 'Videos']
    default:
      return ['All']
  }
})

const activeFilter = ref('All')

function setSort(value: string): void {
  sortBy.value = value
  showSortMenu.value = false
}

function setFilter(value: string): void {
  activeFilter.value = value
  showFilterMenu.value = false
}

// V2: Node preview on hover
const hoveredNode = ref<string | null>(null)
const previewPosition = ref({ top: 0 })

function handleNodeHover(nodeName: string, event: MouseEvent): void {
  hoveredNode.value = nodeName
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  previewPosition.value = { top: rect.top }
}

function handleNodeLeave(): void {
  hoveredNode.value = null
}

// V2: Node category handlers
function handleCategoryClick(categoryId: Exclude<NodeCategoryId, null>): void {
  uiStore.toggleNodeCategory(categoryId)
}

// V1: Legacy tab handlers
function handleTabClick(tabId: Exclude<SidebarTabId, null>): void {
  uiStore.toggleSidebarTab(tabId)
}

// Mock data for legacy tabs - organized by categories like original ComfyUI
const nodeCategories = ref([
  {
    id: 'loaders',
    label: 'Loaders',
    icon: 'pi pi-download',
    expanded: true,
    nodes: [
      { name: 'CheckpointLoaderSimple', display: 'Load Checkpoint' },
      { name: 'VAELoader', display: 'Load VAE' },
      { name: 'LoraLoader', display: 'Load LoRA' },
      { name: 'CLIPLoader', display: 'Load CLIP' },
      { name: 'ControlNetLoader', display: 'Load ControlNet Model' },
      { name: 'UNETLoader', display: 'Load Diffusion Model' },
    ]
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    icon: 'pi pi-sliders-h',
    expanded: false,
    nodes: [
      { name: 'CLIPTextEncode', display: 'CLIP Text Encode (Prompt)' },
      { name: 'ConditioningCombine', display: 'Conditioning (Combine)' },
      { name: 'ConditioningSetArea', display: 'Conditioning (Set Area)' },
      { name: 'ControlNetApply', display: 'Apply ControlNet' },
    ]
  },
  {
    id: 'sampling',
    label: 'Sampling',
    icon: 'pi pi-box',
    expanded: false,
    nodes: [
      { name: 'KSampler', display: 'KSampler' },
      { name: 'KSamplerAdvanced', display: 'KSampler (Advanced)' },
      { name: 'SamplerCustom', display: 'SamplerCustom' },
    ]
  },
  {
    id: 'latent',
    label: 'Latent',
    icon: 'pi pi-th-large',
    expanded: false,
    nodes: [
      { name: 'EmptyLatentImage', display: 'Empty Latent Image' },
      { name: 'LatentUpscale', display: 'Upscale Latent' },
      { name: 'LatentComposite', display: 'Latent Composite' },
      { name: 'VAEDecode', display: 'VAE Decode' },
      { name: 'VAEEncode', display: 'VAE Encode' },
    ]
  },
  {
    id: 'image',
    label: 'Image',
    icon: 'pi pi-image',
    expanded: false,
    nodes: [
      { name: 'LoadImage', display: 'Load Image' },
      { name: 'SaveImage', display: 'Save Image' },
      { name: 'PreviewImage', display: 'Preview Image' },
      { name: 'ImageScale', display: 'Upscale Image' },
      { name: 'ImageInvert', display: 'Invert Image' },
    ]
  },
  {
    id: 'masking',
    label: 'Masking',
    icon: 'pi pi-clone',
    expanded: false,
    nodes: [
      { name: 'LoadImageMask', display: 'Load Image (as Mask)' },
      { name: 'MaskComposite', display: 'Mask Composite' },
      { name: 'ImageToMask', display: 'Convert Image to Mask' },
    ]
  },
])

function toggleCategory(categoryId: string): void {
  const category = nodeCategories.value.find(c => c.id === categoryId)
  if (category) {
    category.expanded = !category.expanded
  }
}

const modelCategories = ref([
  {
    id: 'checkpoints',
    label: 'Checkpoints',
    icon: 'pi pi-box',
    expanded: true,
    models: [
      { name: 'sd_v1-5', display: 'SD 1.5', size: '4.27 GB' },
      { name: 'sd_xl_base_1.0', display: 'SDXL Base 1.0', size: '6.94 GB' },
      { name: 'realistic_vision_v5', display: 'Realistic Vision V5', size: '2.13 GB' },
      { name: 'dreamshaper_8', display: 'DreamShaper 8', size: '2.13 GB' },
      { name: 'deliberate_v3', display: 'Deliberate V3', size: '2.13 GB' },
    ]
  },
  {
    id: 'loras',
    label: 'LoRAs',
    icon: 'pi pi-link',
    expanded: false,
    models: [
      { name: 'add_detail', display: 'Add Detail', size: '144 MB' },
      { name: 'epi_noiseoffset', display: 'Epi Noise Offset', size: '36 MB' },
      { name: 'film_grain', display: 'Film Grain', size: '72 MB' },
      { name: 'lcm_lora_sdxl', display: 'LCM LoRA SDXL', size: '393 MB' },
    ]
  },
  {
    id: 'vae',
    label: 'VAE',
    icon: 'pi pi-sitemap',
    expanded: false,
    models: [
      { name: 'vae-ft-mse-840000', display: 'VAE ft MSE', size: '335 MB' },
      { name: 'sdxl_vae', display: 'SDXL VAE', size: '335 MB' },
    ]
  },
  {
    id: 'controlnet',
    label: 'ControlNet',
    icon: 'pi pi-sliders-v',
    expanded: false,
    models: [
      { name: 'control_v11p_sd15_canny', display: 'Canny (SD1.5)', size: '1.45 GB' },
      { name: 'control_v11p_sd15_openpose', display: 'OpenPose (SD1.5)', size: '1.45 GB' },
      { name: 'control_v11f1p_sd15_depth', display: 'Depth (SD1.5)', size: '1.45 GB' },
      { name: 'controlnet_sdxl_canny', display: 'Canny (SDXL)', size: '2.5 GB' },
    ]
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    icon: 'pi pi-tag',
    expanded: false,
    models: [
      { name: 'easynegative', display: 'EasyNegative', size: '24 KB' },
      { name: 'bad_prompt_v2', display: 'Bad Prompt V2', size: '24 KB' },
      { name: 'ng_deepnegative', display: 'NG DeepNegative', size: '24 KB' },
    ]
  },
  {
    id: 'upscale',
    label: 'Upscale Models',
    icon: 'pi pi-expand',
    expanded: false,
    models: [
      { name: '4x_ultrasharp', display: '4x UltraSharp', size: '67 MB' },
      { name: 'realesrgan_x4plus', display: 'RealESRGAN x4+', size: '64 MB' },
      { name: '4x_nmkd_superscale', display: '4x NMKD Superscale', size: '67 MB' },
    ]
  },
])

function toggleModelCategory(categoryId: string): void {
  const category = modelCategories.value.find(c => c.id === categoryId)
  if (category) {
    category.expanded = !category.expanded
  }
}

const mockWorkflows = [
  { name: 'Basic txt2img', date: '2024-01-15', nodes: 8, thumbnail: 'txt2img' },
  { name: 'Img2Img Pipeline', date: '2024-01-14', nodes: 12, thumbnail: 'img2img' },
  { name: 'ControlNet Canny', date: '2024-01-13', nodes: 15, thumbnail: 'controlnet' },
  { name: 'SDXL with Refiner', date: '2024-01-12', nodes: 18, thumbnail: 'sdxl' },
  { name: 'Inpainting Setup', date: '2024-01-10', nodes: 10, thumbnail: 'inpaint' },
]

const mockAssets = [
  { name: 'reference_01.png', type: 'image' },
  { name: 'mask_template.png', type: 'image' },
  { name: 'init_image.jpg', type: 'image' },
]

const templateCategories = ref([
  {
    id: 'official',
    label: 'Official',
    icon: 'pi pi-verified',
    expanded: true,
    templates: [
      { name: 'txt2img-basic', display: 'Text to Image (Basic)', description: 'Simple text-to-image generation', nodes: 6 },
      { name: 'img2img-basic', display: 'Image to Image', description: 'Transform existing images', nodes: 8 },
      { name: 'inpainting', display: 'Inpainting', description: 'Fill masked regions', nodes: 10 },
      { name: 'upscaling', display: 'Upscaling', description: '2x-4x image upscaling', nodes: 5 },
    ]
  },
  {
    id: 'sdxl',
    label: 'SDXL',
    icon: 'pi pi-star',
    expanded: false,
    templates: [
      { name: 'sdxl-txt2img', display: 'SDXL Text to Image', description: 'SDXL base workflow', nodes: 8 },
      { name: 'sdxl-refiner', display: 'SDXL + Refiner', description: 'Base with refiner', nodes: 14 },
      { name: 'sdxl-lightning', display: 'SDXL Lightning', description: '4-step fast generation', nodes: 9 },
    ]
  },
  {
    id: 'controlnet',
    label: 'ControlNet',
    icon: 'pi pi-sliders-v',
    expanded: false,
    templates: [
      { name: 'cn-canny', display: 'Canny Edge', description: 'Edge detection control', nodes: 12 },
      { name: 'cn-depth', display: 'Depth Map', description: 'Depth-based control', nodes: 12 },
      { name: 'cn-openpose', display: 'OpenPose', description: 'Pose control', nodes: 14 },
      { name: 'cn-lineart', display: 'Line Art', description: 'Sketch to image', nodes: 11 },
    ]
  },
  {
    id: 'video',
    label: 'Video',
    icon: 'pi pi-video',
    expanded: false,
    templates: [
      { name: 'svd-basic', display: 'SVD Image to Video', description: 'Stable Video Diffusion', nodes: 10 },
      { name: 'animatediff', display: 'AnimateDiff', description: 'Animation generation', nodes: 16 },
    ]
  },
  {
    id: 'community',
    label: 'Community',
    icon: 'pi pi-users',
    expanded: false,
    templates: [
      { name: 'portrait-enhance', display: 'Portrait Enhancer', description: 'Face restoration workflow', nodes: 12 },
      { name: 'style-transfer', display: 'Style Transfer', description: 'Apply art styles', nodes: 14 },
      { name: 'batch-process', display: 'Batch Processing', description: 'Process multiple images', nodes: 18 },
    ]
  },
])

function toggleTemplateCategory(categoryId: string): void {
  const category = templateCategories.value.find(c => c.id === categoryId)
  if (category) {
    category.expanded = !category.expanded
  }
}
</script>

<template>
  <div class="flex h-full">
    <!-- ================================================================== -->
    <!-- V2 INTERFACE: TouchDesigner/Houdini-style Node Categories          -->
    <!-- ================================================================== -->
    <template v-if="isV2">
      <!-- Level 1: Category Icon Bar -->
      <nav class="flex w-12 flex-col items-center border-r border-zinc-800 bg-zinc-900 py-2">
        <!-- Category buttons with colors -->
        <div class="flex flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-hide">
          <button
            v-for="category in NODE_CATEGORIES"
            :key="category.id"
            v-tooltip.right="{ value: category.label, showDelay: 50 }"
            class="flex h-8 w-8 items-center justify-center rounded-md transition-all"
            :class="[
              activeNodeCategory === category.id
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-200'
            ]"
            :style="{
              backgroundColor: activeNodeCategory === category.id ? category.color + '15' : 'transparent',
            }"
            @click="handleCategoryClick(category.id)"
          >
            <i :class="[category.icon, 'text-base']" :style="{ color: activeNodeCategory === category.id ? category.color : undefined }" />
          </button>
        </div>

        <!-- Bottom section -->
        <div class="mt-auto flex flex-col gap-1 pt-2">
          <button
            v-tooltip.right="{ value: 'Settings', showDelay: 50 }"
            class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <i class="pi pi-cog text-xs" />
          </button>
        </div>
      </nav>

      <!-- Level 2: Subcategory Panel -->
      <aside
        class="border-r border-zinc-800 bg-zinc-900/98 transition-all duration-200 ease-out"
        :class="nodePanelExpanded ? 'w-72' : 'w-0 overflow-hidden'"
      >
        <div v-if="nodePanelExpanded && activeNodeCategoryData" class="flex h-full w-72 flex-col">
          <!-- Panel Header with category color -->
          <div
            class="flex items-center justify-between border-b border-zinc-800 px-3 py-2"
          >
            <div class="flex items-center gap-2">
              <i
                :class="activeNodeCategoryData.icon"
                class="text-sm"
                :style="{ color: activeNodeCategoryData.color }"
              />
              <span
                class="text-sm font-semibold"
                :style="{ color: activeNodeCategoryData.color }"
              >
                {{ activeNodeCategoryData.label }}
              </span>
            </div>
            <Button
              icon="pi pi-times"
              text
              severity="secondary"
              size="small"
              class="!h-6 !w-6"
              @click="uiStore.closeNodePanel()"
            />
          </div>

          <!-- Search Box -->
          <div class="border-b border-zinc-800/50 p-2">
            <div class="relative">
              <i class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500" />
              <InputText
                v-model="searchQuery"
                :placeholder="`Search ${activeNodeCategoryData.label.toLowerCase()}...`"
                class="!h-8 w-full !rounded !border-zinc-700 !bg-zinc-800/50 !pl-8 !text-xs"
              />
            </div>
          </div>

          <!-- Nodes List (flat, no dropdowns) -->
          <div class="flex-1 overflow-y-auto">
            <div class="p-2 space-y-3">
              <div
                v-for="subcategory in activeNodeCategoryData.subcategories"
                :key="subcategory.id"
              >
                <!-- Subcategory Label -->
                <div class="mb-1 flex h-5 items-center rounded bg-zinc-950/70 px-2">
                  <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {{ subcategory.label }}
                  </span>
                </div>

                <!-- Nodes -->
                <div class="space-y-0.5">
                  <div
                    v-for="nodeName in subcategory.nodes"
                    :key="nodeName"
                    class="group flex cursor-pointer items-center rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
                    draggable="true"
                    @mouseenter="handleNodeHover(nodeName, $event)"
                    @mouseleave="handleNodeLeave"
                  >
                    <span class="flex-1 truncate text-xs text-zinc-400 group-hover:text-zinc-200">
                      {{ nodeName }}
                    </span>
                    <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer with node count -->
          <div class="border-t border-zinc-800/50 px-3 py-2">
            <div class="text-[10px] text-zinc-500">
              {{ activeNodeCategoryData.subcategories.reduce((acc, sub) => acc + sub.nodes.length, 0) }} nodes
            </div>
          </div>
        </div>
      </aside>

      <!-- Node Preview Popup -->
      <Transition name="fade">
        <div
          v-if="hoveredNode && nodePanelExpanded"
          class="pointer-events-none fixed z-50 ml-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl"
          :style="{ top: `${previewPosition.top}px`, left: 'calc(48px + 288px + 8px)' }"
        >
          <div class="mb-2 flex items-center gap-2">
            <span
              class="text-sm font-medium"
              :style="{ color: activeNodeCategoryData?.color }"
            >{{ hoveredNode }}</span>
          </div>
          <p class="text-xs leading-relaxed text-zinc-400">
            Node for processing data in the workflow. Drag to canvas to add.
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">input: any</span>
            <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">output: any</span>
          </div>
        </div>
      </Transition>
    </template>

    <!-- ================================================================== -->
    <!-- V1 INTERFACE: Legacy Sidebar with Nodes, Models, Workflows, etc.   -->
    <!-- ================================================================== -->
    <template v-else>
      <!-- Icon Toolbar -->
      <nav class="flex w-12 flex-col items-center border-r border-zinc-800 bg-zinc-900 py-2">
        <!-- Tab buttons -->
        <div class="flex flex-col gap-1">
          <button
            v-for="tab in SIDEBAR_TABS"
            :key="tab.id"
            v-tooltip.right="{ value: tab.tooltip, showDelay: 50 }"
            class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            :class="[
              activeSidebarTab === tab.id
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            ]"
            @click="handleTabClick(tab.id)"
          >
            <i :class="[tab.icon, 'text-sm']" />
          </button>
        </div>

        <!-- Bottom section -->
        <div class="mt-auto flex flex-col gap-1">
          <button
            v-tooltip.right="{ value: 'Console', showDelay: 50 }"
            class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <i class="pi pi-code text-sm" />
          </button>
          <button
            v-tooltip.right="{ value: 'Settings', showDelay: 50 }"
            class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <i class="pi pi-cog text-sm" />
          </button>
          <button
            v-tooltip.right="{ value: 'Help', showDelay: 50 }"
            class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <i class="pi pi-question-circle text-sm" />
          </button>
        </div>
      </nav>

      <!-- Expandable Panel -->
      <aside
        class="border-r border-zinc-800 bg-zinc-900/95 transition-all duration-200"
        :class="sidebarPanelExpanded ? 'w-80' : 'w-0 overflow-hidden'"
      >
        <div v-if="sidebarPanelExpanded" class="flex h-full w-80 flex-col">
          <!-- Panel Header -->
          <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {{ SIDEBAR_TABS.find(t => t.id === activeSidebarTab)?.label }}
            </span>
            <Button
              icon="pi pi-times"
              text
              severity="secondary"
              size="small"
              class="!h-6 !w-6"
              @click="uiStore.closeSidebarPanel()"
            />
          </div>

          <!-- Search Box -->
          <div class="border-b border-zinc-800 p-2">
            <div class="flex items-center gap-2">
              <div class="flex flex-1 items-center rounded bg-zinc-800 px-2 py-1.5">
                <i class="pi pi-search text-xs text-zinc-500" />
                <input
                  type="text"
                  :placeholder="`Search ${SIDEBAR_TABS.find(t => t.id === activeSidebarTab)?.label?.toLowerCase()}...`"
                  class="ml-2 w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-500"
                />
              </div>
              <!-- Import button for workflows -->
              <button
                v-if="activeSidebarTab === 'workflows'"
                v-tooltip.top="{ value: 'Import Workflow', showDelay: 50 }"
                class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                <i class="pi pi-plus text-xs" />
              </button>
            </div>

            <!-- View Controls -->
            <div class="mt-2 flex items-center justify-between">
              <!-- View Mode Toggle -->
              <div class="flex items-center rounded bg-zinc-800 p-0.5">
                <button
                  v-tooltip.bottom="{ value: 'List View', showDelay: 50 }"
                  class="flex h-6 w-6 items-center justify-center rounded transition-colors"
                  :class="viewMode === 'list' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
                  @click="viewMode = 'list'"
                >
                  <i class="pi pi-list text-[10px]" />
                </button>
                <button
                  v-tooltip.bottom="{ value: 'Grid View', showDelay: 50 }"
                  class="flex h-6 w-6 items-center justify-center rounded transition-colors"
                  :class="viewMode === 'grid' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
                  @click="viewMode = 'grid'"
                >
                  <i class="pi pi-th-large text-[10px]" />
                </button>
              </div>

              <!-- Filter & Sort -->
              <div class="flex items-center gap-1">
                <!-- Filter Dropdown -->
                <div class="relative">
                  <button
                    class="flex h-6 items-center gap-1 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                    @click="showFilterMenu = !showFilterMenu"
                  >
                    <i class="pi pi-filter text-[10px]" />
                    <span>{{ activeFilter }}</span>
                    <i class="pi pi-chevron-down text-[8px]" />
                  </button>
                  <!-- Filter Menu -->
                  <div
                    v-if="showFilterMenu"
                    class="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
                  >
                    <button
                      v-for="option in filterOptions"
                      :key="option"
                      class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
                      :class="activeFilter === option ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
                      @click="setFilter(option)"
                    >
                      {{ option }}
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
                  <!-- Sort Menu -->
                  <div
                    v-if="showSortMenu"
                    class="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
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

          <!-- Panel Content -->
          <div class="flex-1 overflow-y-auto p-2">
            <!-- Nodes Tab - Tree Structure -->
            <div v-if="activeSidebarTab === 'nodes'" class="space-y-0.5">
              <div
                v-for="category in nodeCategories"
                :key="category.id"
                class="select-none"
              >
                <!-- Category Header (Folder) -->
                <button
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
                  @click="toggleCategory(category.id)"
                >
                  <i
                    class="text-[10px] text-zinc-500 transition-transform"
                    :class="category.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                  />
                  <i :class="[category.icon, 'text-xs text-zinc-400']" />
                  <span class="flex-1 text-xs font-medium text-zinc-300">
                    {{ category.label }}
                  </span>
                  <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {{ category.nodes.length }}
                  </span>
                </button>

                <!-- Nodes List (Expandable) -->
                <div
                  v-if="category.expanded"
                  class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2"
                >
                  <div
                    v-for="node in category.nodes"
                    :key="node.name"
                    class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-zinc-800"
                    draggable="true"
                  >
                    <i class="pi pi-circle-fill text-[5px] text-zinc-600 group-hover:text-zinc-400" />
                    <span class="flex-1 truncate text-xs text-zinc-400 group-hover:text-zinc-200">
                      {{ node.display }}
                    </span>
                    <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Models Tab - Tree Structure -->
            <div v-else-if="activeSidebarTab === 'models'" class="space-y-0.5">
              <div
                v-for="category in modelCategories"
                :key="category.id"
                class="select-none"
              >
                <!-- Category Header (Folder) -->
                <button
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
                  @click="toggleModelCategory(category.id)"
                >
                  <i
                    class="text-[10px] text-zinc-500 transition-transform"
                    :class="category.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                  />
                  <i :class="[category.icon, 'text-xs text-zinc-400']" />
                  <span class="flex-1 text-xs font-medium text-zinc-300">
                    {{ category.label }}
                  </span>
                  <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {{ category.models.length }}
                  </span>
                </button>

                <!-- Models List (Expandable) -->
                <div
                  v-if="category.expanded"
                  class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2"
                >
                  <div
                    v-for="model in category.models"
                    :key="model.name"
                    class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
                    draggable="true"
                  >
                    <i class="pi pi-file text-[10px] text-zinc-600 group-hover:text-zinc-400" />
                    <div class="flex-1 min-w-0">
                      <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
                        {{ model.display }}
                      </div>
                      <div class="text-[10px] text-zinc-600">{{ model.size }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Workflows Tab -->
            <div v-else-if="activeSidebarTab === 'workflows'" class="space-y-2">
              <!-- Workflow Cards -->
              <div
                v-for="workflow in mockWorkflows"
                :key="workflow.name"
                class="group cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
              >
                <!-- Thumbnail (16:9) -->
                <div class="relative aspect-video bg-zinc-950">
                  <!-- Placeholder thumbnail with gradient based on workflow type -->
                  <div
                    class="absolute inset-0 flex items-center justify-center"
                    :class="{
                      'bg-gradient-to-br from-blue-900/30 to-purple-900/30': workflow.thumbnail === 'txt2img',
                      'bg-gradient-to-br from-green-900/30 to-teal-900/30': workflow.thumbnail === 'img2img',
                      'bg-gradient-to-br from-orange-900/30 to-red-900/30': workflow.thumbnail === 'controlnet',
                      'bg-gradient-to-br from-violet-900/30 to-pink-900/30': workflow.thumbnail === 'sdxl',
                      'bg-gradient-to-br from-cyan-900/30 to-blue-900/30': workflow.thumbnail === 'inpaint',
                    }"
                  >
                    <i class="pi pi-sitemap text-2xl text-zinc-700" />
                  </div>
                  <!-- Share Button (always visible) -->
                  <button
                    v-tooltip.left="{ value: 'Share', showDelay: 50 }"
                    class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded bg-zinc-800/90 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    <i class="pi pi-share-alt text-[10px]" />
                  </button>
                  <!-- Node count badge -->
                  <div class="absolute bottom-1.5 left-1.5 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {{ workflow.nodes }} nodes
                  </div>
                </div>
                <!-- Info -->
                <div class="flex items-center justify-between px-2.5 py-2">
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-xs font-medium text-zinc-300">{{ workflow.name }}</div>
                    <div class="mt-0.5 text-[10px] text-zinc-500">{{ workflow.date }}</div>
                  </div>
                  <!-- Add to canvas button -->
                  <button
                    v-tooltip.left="{ value: 'Add to Canvas', showDelay: 50 }"
                    class="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-blue-600 text-white transition-all hover:bg-blue-500"
                  >
                    <i class="pi pi-plus text-[10px]" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Assets Tab -->
            <div v-else-if="activeSidebarTab === 'assets'" class="space-y-1">
              <div
                v-for="asset in mockAssets"
                :key="asset.name"
                class="cursor-pointer rounded px-2 py-1.5 text-xs transition-colors hover:bg-zinc-800"
              >
                <i class="pi pi-image mr-2 text-zinc-500" />
                <span class="text-zinc-300">{{ asset.name }}</span>
              </div>
            </div>

            <!-- Templates Tab - Tree Structure -->
            <div v-else-if="activeSidebarTab === 'templates'" class="space-y-0.5">
              <div
                v-for="category in templateCategories"
                :key="category.id"
                class="select-none"
              >
                <!-- Category Header (Folder) -->
                <button
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
                  @click="toggleTemplateCategory(category.id)"
                >
                  <i
                    class="text-[10px] text-zinc-500 transition-transform"
                    :class="category.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                  />
                  <i :class="[category.icon, 'text-xs text-zinc-400']" />
                  <span class="flex-1 text-xs font-medium text-zinc-300">
                    {{ category.label }}
                  </span>
                  <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {{ category.templates.length }}
                  </span>
                </button>

                <!-- Templates List (Expandable) -->
                <div
                  v-if="category.expanded"
                  class="ml-4 space-y-0.5 border-l border-zinc-800 pl-2"
                >
                  <div
                    v-for="template in category.templates"
                    :key="template.name"
                    class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
                    draggable="true"
                  >
                    <i class="pi pi-clone text-[10px] text-zinc-600 group-hover:text-zinc-400" />
                    <div class="flex-1 min-w-0">
                      <div class="truncate text-xs text-zinc-400 group-hover:text-zinc-200">
                        {{ template.display }}
                      </div>
                      <div class="truncate text-[10px] text-zinc-600">{{ template.description }}</div>
                    </div>
                    <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600">
                      {{ template.nodes }}
                    </span>
                    <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Library Tab -->
            <div v-else-if="activeSidebarTab === 'library'" class="space-y-2">
              <div class="text-xs text-zinc-500">
                <i class="pi pi-bookmark mr-2" />
                Bookmarked items will appear here
              </div>
            </div>
          </div>
        </div>
      </aside>
    </template>
  </div>
</template>

<style scoped>
/* Hide scrollbar but keep functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Custom scrollbar for the panel */
aside ::-webkit-scrollbar {
  width: 4px;
}

aside ::-webkit-scrollbar-track {
  background: transparent;
}

aside ::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 2px;
}

aside ::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}

/* Fade transition for node preview */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
