<template>
  <Card
    ref="cardRef"
    :data-testid="`template-workflow-${template.name}`"
    class="w-64 template-card rounded-2xl overflow-hidden shadow-elevation-2 dark-theme:bg-dark-elevation-1.5 h-full"
    :class="{
      'cursor-pointer': isCompatible,
      'cursor-not-allowed opacity-60 grayscale': !isCompatible
    }"
    :pt="{
      body: { class: 'p-0 h-full flex flex-col' }
    }"
    @click="handleCardClick"
  >
    <template #header>
      <div class="flex items-center justify-center relative">
        <div class="relative overflow-hidden rounded-t-lg">
          <template v-if="template.mediaType === 'audio'">
            <AudioThumbnail :src="baseThumbnailSrc" />
          </template>
          <template v-else-if="template.thumbnailVariant === 'compareSlider'">
            <CompareSliderThumbnail
              :base-image-src="baseThumbnailSrc"
              :overlay-image-src="overlayThumbnailSrc"
              :alt="title"
              :is-hovered="isHovered && isCompatible"
              :is-video="
                template.mediaType === 'video' ||
                template.mediaSubtype === 'webp'
              "
            />
          </template>
          <template v-else-if="template.thumbnailVariant === 'hoverDissolve'">
            <HoverDissolveThumbnail
              :base-image-src="baseThumbnailSrc"
              :overlay-image-src="overlayThumbnailSrc"
              :alt="title"
              :is-hovered="isHovered && isCompatible"
              :is-video="
                template.mediaType === 'video' ||
                template.mediaSubtype === 'webp'
              "
            />
          </template>
          <template v-else>
            <DefaultThumbnail
              :src="baseThumbnailSrc"
              :alt="title"
              :is-hovered="isHovered && isCompatible"
              :is-video="
                template.mediaType === 'video' ||
                template.mediaSubtype === 'webp'
              "
              :hover-zoom="
                template.thumbnailVariant === 'zoomHover'
                  ? UPSCALE_ZOOM_SCALE
                  : DEFAULT_ZOOM_SCALE
              "
            />
          </template>
          <ProgressSpinner
            v-if="loading"
            class="absolute inset-0 z-1 w-3/12 h-full"
          />
        </div>
        <!-- Version incompatibility indicator -->
        <div
          v-if="!isCompatible"
          class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10"
          :title="
            $t('templateWorkflows.requiresUpgrade', {
              version: template.versionRequired
            })
          "
        >
          <i class="pi pi-exclamation-triangle text-xs"></i>
          <span class="text-xs font-medium"
            >v{{ template.versionRequired }}+</span
          >
        </div>
      </div>
    </template>
    <template #content>
      <div class="flex items-center px-4 py-3">
        <div class="flex-1 flex flex-col">
          <h3 class="line-clamp-2 text-lg font-normal mb-0" :title="title">
            {{ title }}
          </h3>
          <p class="line-clamp-2 text-sm text-muted grow" :title="description">
            {{ description }}
          </p>
          <!-- Upgrade prompt for incompatible templates -->
          <div
            v-if="!isCompatible"
            class="mt-2 text-xs text-yellow-600 dark:text-yellow-400 font-medium"
          >
            {{ $t('templateWorkflows.upgradeToUse') }}
            <br />
            <span class="text-muted">
              {{
                $t('templateWorkflows.currentVersion', {
                  version: currentVersion
                })
              }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'

import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import { useTemplateWorkflows } from '@/composables/useTemplateWorkflows'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { TemplateInfo } from '@/types/workflowTemplateTypes'
import { compareVersions } from '@/utils/formatUtil'

const UPSCALE_ZOOM_SCALE = 16 // for upscale templates, exaggerate the hover zoom
const DEFAULT_ZOOM_SCALE = 5

const { sourceModule, loading, template } = defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: boolean
  template: TemplateInfo
}>()

const cardRef = ref<HTMLElement | null>(null)
const isHovered = useElementHover(cardRef)
const systemStatsStore = useSystemStatsStore()

const { getTemplateThumbnailUrl, getTemplateTitle, getTemplateDescription } =
  useTemplateWorkflows()

// Determine the effective source module to use (from template or prop)
const effectiveSourceModule = computed(
  () => template.sourceModule || sourceModule
)

const baseThumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(
    template,
    effectiveSourceModule.value,
    effectiveSourceModule.value === 'default' ? '1' : ''
  )
)

const overlayThumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(
    template,
    effectiveSourceModule.value,
    effectiveSourceModule.value === 'default' ? '2' : ''
  )
)

const description = computed(() =>
  getTemplateDescription(template, effectiveSourceModule.value)
)
const title = computed(() =>
  getTemplateTitle(template, effectiveSourceModule.value)
)

// Version compatibility check
const currentVersion = computed(() => {
  return systemStatsStore.systemStats?.system?.comfyui_version || ''
})

const isCompatible = computed(() => {
  if (!template.versionRequired) {
    return true // No version requirement, always compatible
  }

  if (!currentVersion.value) {
    return false // No current version available, assume incompatible
  }

  // Return true if current version is >= required version
  return compareVersions(currentVersion.value, template.versionRequired) >= 0
})

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()

const handleCardClick = () => {
  if (isCompatible.value) {
    emit('loadWorkflow', template.name)
  }
}
</script>
