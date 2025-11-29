<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  WorkspaceViewHeader,
  WorkspaceSearchInput,
  WorkspaceViewToggle,
  WorkspaceSortSelect,
  WorkspaceFilterSelect,
  WorkspaceCard,
} from '@/components/v2/workspace'

const route = useRoute()
const router = useRouter()
const workspaceId = computed(() => route.params.workspaceId as string)

type ViewMode = 'grid' | 'list'

const searchQuery = ref('')
const viewMode = ref<ViewMode>('grid')
const sortBy = ref('popular')
const filterBy = ref('all')

const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'name', label: 'Name' },
]

const filterOptions = [
  { value: 'all', label: 'All Categories' },
  { value: 'official', label: 'Official' },
  { value: 'sdxl', label: 'SDXL' },
  { value: 'controlnet', label: 'ControlNet' },
  { value: 'video', label: 'Video' },
  { value: 'community', label: 'Community' },
]

const templates = ref([
  { id: 'txt2img', name: 'Text to Image', description: 'Generate images from text prompts', category: 'official', icon: 'pi pi-image', thumbnail: '/assets/card_images/workflow_01.webp', uses: 12500 },
  { id: 'img2img', name: 'Image to Image', description: 'Transform existing images', category: 'official', icon: 'pi pi-images', thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp', uses: 8900 },
  { id: 'upscale', name: 'Upscale 4x', description: '4x image upscaling workflow', category: 'official', icon: 'pi pi-expand', thumbnail: '/assets/card_images/bacb46ea-7e63-4f19-a253-daf41461e98f.webp', uses: 7200 },
  { id: 'inpaint', name: 'Inpainting', description: 'Edit parts of an image', category: 'official', icon: 'pi pi-pencil', thumbnail: '/assets/card_images/228616f4-12ad-426d-84fb-f20e488ba7ee.webp', uses: 6100 },
  { id: 'controlnet', name: 'ControlNet Pose', description: 'Pose-guided generation', category: 'controlnet', icon: 'pi pi-sliders-h', thumbnail: '/assets/card_images/683255d3-1d10-43d9-a6ff-ef142061e88a.webp', uses: 5400 },
  { id: 'video', name: 'Video Generation', description: 'Create videos from prompts', category: 'video', icon: 'pi pi-video', thumbnail: '/assets/card_images/91f1f589-ddb4-4c4f-b3a7-ba30fc271987.webp', uses: 4800 },
  { id: 'sdxl-turbo', name: 'SDXL Turbo', description: 'Fast SDXL generation', category: 'sdxl', icon: 'pi pi-bolt', thumbnail: '/assets/card_images/28e9f7ea-ef00-48e8-849d-8752a34939c7.webp', uses: 4200 },
  { id: 'canny', name: 'ControlNet Canny', description: 'Edge-guided generation', category: 'controlnet', icon: 'pi pi-stop', thumbnail: '/assets/card_images/comfyui_workflow.jpg', uses: 3800 },
  { id: 'depth', name: 'ControlNet Depth', description: 'Depth-guided generation', category: 'controlnet', icon: 'pi pi-box', thumbnail: '/assets/card_images/can-you-rate-my-comfyui-workflow-v0-o9clchhji39c1.webp', uses: 3500 },
  { id: 'sdxl-refiner', name: 'SDXL + Refiner', description: 'Two-stage SDXL workflow', category: 'sdxl', icon: 'pi pi-sparkles', thumbnail: '/assets/card_images/dda28581-37c8-44da-8822-57d1ccc2118c_2130x1658.png', uses: 3200 },
  { id: 'animatediff', name: 'AnimateDiff', description: 'Animate images to video', category: 'video', icon: 'pi pi-play', thumbnail: '/thumbnails/workflow-1.jpg', uses: 2900 },
  { id: 'face-swap', name: 'Face Swap', description: 'Swap faces in images', category: 'community', icon: 'pi pi-user', thumbnail: '/thumbnails/workflow-2.jpg', uses: 2600 },
])

const filteredTemplates = computed(() => {
  let result = [...templates.value]

  if (filterBy.value !== 'all') {
    result = result.filter(t => t.category === filterBy.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    )
  }

  if (sortBy.value === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'popular') {
    result.sort((a, b) => b.uses - a.uses)
  }

  return result
})

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    official: 'bg-blue-500/20 text-blue-400',
    sdxl: 'bg-purple-500/20 text-purple-400',
    controlnet: 'bg-green-500/20 text-green-400',
    video: 'bg-amber-500/20 text-amber-400',
    community: 'bg-pink-500/20 text-pink-400',
  }
  return colors[category] || 'bg-zinc-500/20 text-zinc-400'
}

function formatUses(uses: number): string {
  if (uses >= 1000) {
    return `${(uses / 1000).toFixed(1)}k`
  }
  return uses.toString()
}

function openTemplate(templateId: string): void {
  router.push(`/${workspaceId.value}/default/${templateId}`)
}
</script>

<template>
  <div class="p-6">
    <WorkspaceViewHeader
      title="Templates"
      :subtitle="`${templates.length} templates available`"
      :show-create-buttons="true"
    />

    <!-- Search & Filters -->
    <div class="mb-4 flex items-center gap-3">
      <WorkspaceSearchInput
        v-model="searchQuery"
        placeholder="Search templates..."
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
        v-for="template in filteredTemplates"
        :key="template.id"
        :thumbnail="template.thumbnail"
        :title="template.name"
        :description="template.description"
        :icon="template.icon"
        :badge="template.category"
        :badge-class="getCategoryColor(template.category)"
        action-label="Run"
        action-icon="pi pi-play"
        :stats="[{ icon: 'pi pi-users', value: formatUses(template.uses) }]"
        @click="openTemplate(template.id)"
      />
    </div>

    <!-- List View -->
    <div v-else class="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          @click="openTemplate(template.id)"
        >
          <div class="h-12 w-12 overflow-hidden rounded-md">
            <img :src="template.thumbnail" :alt="template.name" class="h-full w-full object-cover" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ template.name }}</p>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">{{ template.description }}</p>
          </div>
          <span :class="['rounded px-2 py-1 text-xs font-medium capitalize', getCategoryColor(template.category)]">
            {{ template.category }}
          </span>
          <span class="flex items-center gap-1 text-sm text-zinc-400 dark:text-zinc-500">
            <i class="pi pi-users text-xs" />
            {{ formatUses(template.uses) }}
          </span>
          <button
            class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <i class="pi pi-play text-xs" />
            Run
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredTemplates.length === 0" class="py-12 text-center">
      <i class="pi pi-search mb-4 text-4xl text-zinc-300 dark:text-zinc-600" />
      <p class="text-zinc-500 dark:text-zinc-400">No templates found</p>
    </div>
  </div>
</template>
