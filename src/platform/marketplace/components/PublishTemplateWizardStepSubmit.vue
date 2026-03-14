<template>
  <div data-testid="step-submit" class="flex flex-col gap-4">
    <div
      v-if="submitted"
      class="border-success bg-success/10 rounded-lg border p-4 text-sm"
    >
      {{ $t('marketplace.submitted') }}
    </div>
    <div v-else ref="gridContainerRef" class="flex flex-col gap-2 text-sm">
      <p>{{ $t('marketplace.previewDescription') }}</p>
      <TemplateCardGrid
        :templates="displayTemplates"
        :is-loading="isLoading"
        :is-loading-more="false"
        :loading-template-name="null"
        :hovered-template-name="null"
        :interactive="false"
      >
        <template #prepend>
          <MarketplaceTemplatePreviewCard
            :title="form.title"
            :short-description="form.shortDescription"
            :license-label="licenseLabel"
            :difficulty-label="difficultyLabel"
            :tags="form.tags"
            :thumbnail-url="thumbnailUrl"
          />
        </template>
      </TemplateCardGrid>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import MarketplaceTemplatePreviewCard from '@/platform/marketplace/components/MarketplaceTemplatePreviewCard.vue'
import TemplateCardGrid from '@/platform/workflow/templates/components/TemplateCardGrid.vue'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

const MIN_CARD_WIDTH_PX = 240
const GRID_GAP_PX = 16

const gridContainerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(gridContainerRef)

const cardsPerRow = computed(() => {
  const w = containerWidth.value
  if (w <= 0) return 3
  return Math.max(
    1,
    Math.floor((w + GRID_GAP_PX) / (MIN_CARD_WIDTH_PX + GRID_GAP_PX))
  )
})

const props = defineProps<{
  form: {
    title: string
    description: string
    shortDescription: string
    difficulty: string
    tags: string[]
  }
  submitted: boolean
  licenseLabel: string
  difficultyLabel: string
  thumbnailUrl: string | null
}>()

const workflowTemplatesStore = useWorkflowTemplatesStore()
const isLoading = computed(() => !workflowTemplatesStore.isLoaded)
const displayTemplates = computed(() =>
  workflowTemplatesStore.enhancedTemplates.slice(
    0,
    Math.max(0, cardsPerRow.value - 1)
  )
)

onMounted(() => {
  if (!workflowTemplatesStore.isLoaded) {
    void workflowTemplatesStore.loadWorkflowTemplates()
  }
})
</script>
