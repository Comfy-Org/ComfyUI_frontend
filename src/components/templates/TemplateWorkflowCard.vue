<template>
  <Card
    ref="cardRef"
    :data-testid="`template-workflow-${template.name}`"
    class="w-64 template-card rounded-2xl overflow-hidden cursor-pointer shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.05)]"
    :pt="{
      body: { class: 'p-0 rounded-2xl' },
      content: { class: 'rounded-2xl' }
    }"
    @click="emit('loadWorkflow', template.name)"
  >
    <template #header>
      <div class="flex items-center justify-center">
        <div class="relative overflow-hidden rounded-t-lg">
          <template v-if="template.mediaType === 'audio'">
            <AudioThumbnail :src="baseThumbnailSrc" />
          </template>
          <template v-else-if="template.thumbnailVariant === 'compareSlider'">
            <CompareSliderThumbnail
              :base-image-src="baseThumbnailSrc"
              :overlay-image-src="overlayThumbnailSrc"
              :alt="title"
              :is-hovered="isHovered"
            />
          </template>
          <template v-else-if="template.thumbnailVariant === 'hoverDissolve'">
            <HoverDissolveThumbnail
              :base-image-src="baseThumbnailSrc"
              :overlay-image-src="overlayThumbnailSrc"
              :alt="title"
              :is-hovered="isHovered"
            />
          </template>
          <template v-else>
            <DefaultThumbnail
              :src="baseThumbnailSrc"
              :alt="title"
              :is-hovered="isHovered"
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
      </div>
    </template>
    <template #content>
      <div class="flex items-center px-4 py-3 group/card">
        <div class="flex-1">
          <h3
            class="text-lg font-normal text-surface-900 dark:text-surface-0 line-clamp-1"
          >
            {{ title }}
          </h3>
          <p
            class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2"
          >
            {{ template.description }}
          </p>
        </div>
        <div
          class="flex items-center justify-center ml-4 w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800"
        >
          <i
            class="pi pi-angle-right text-2xl text-surface-600 dark:text-surface-400"
          ></i>
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
import { useI18n } from 'vue-i18n'

import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import { TemplateInfo } from '@/types/workflowTemplateTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

const UPSCALE_ZOOM_SCALE = 16 // for upscale templates, exaggerate the hover zoom
const DEFAULT_ZOOM_SCALE = 5

const { sourceModule, categoryTitle, loading, template } = defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: boolean
  template: TemplateInfo
}>()

const { t } = useI18n()

const cardRef = ref<HTMLElement | null>(null)
const isHovered = useElementHover(cardRef)

const thumbnailSrc = computed(() =>
  sourceModule === 'default'
    ? `/templates/${template.name}`
    : `/api/workflow_templates/${sourceModule}/${template.name}`
)

const baseThumbnailSrc = computed(() =>
  sourceModule === 'default'
    ? `${thumbnailSrc.value}-1.${template.mediaSubtype}`
    : `${thumbnailSrc.value}.${template.mediaSubtype}`
)

const overlayThumbnailSrc = computed(() =>
  sourceModule === 'default'
    ? `${thumbnailSrc.value}-2.${template.mediaSubtype}`
    : `${thumbnailSrc.value}.${template.mediaSubtype}`
)

const title = computed(() => {
  return sourceModule === 'default'
    ? t(
        `templateWorkflows.template.${normalizeI18nKey(categoryTitle)}.${normalizeI18nKey(template.name)}`
      )
    : template.name ?? `${sourceModule} Template`
})

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()
</script>
