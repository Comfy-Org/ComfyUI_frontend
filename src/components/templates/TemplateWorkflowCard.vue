<template>
  <Card
    ref="cardRef"
    :data-testid="`template-workflow-${template.name}`"
    class="w-64 group"
  >
    <template #header>
      <div
        class="flex items-center justify-center cursor-pointer"
        @click="$emit('loadWorkflow', template.name)"
      >
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
    <template #subtitle>
      <div
        class="text-center py-2 opacity-85 group-hover:opacity-100 transition-opacity"
      >
        {{ title }}
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

const UPSCALE_ZOOM_SCALE = 38 // for upscale templates, exaggerate the hover zoom
const DEFAULT_ZOOM_SCALE = 6

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

const baseThumbnailSrc = computed(
  () => `${thumbnailSrc.value}-1.${template.mediaSubtype}`
)

const overlayThumbnailSrc = computed(
  () => `${thumbnailSrc.value}-2.${template.mediaSubtype}`
)

const title = computed(() => {
  return sourceModule === 'default'
    ? t(
        `templateWorkflows.template.${normalizeI18nKey(categoryTitle)}.${normalizeI18nKey(template.name)}`
      )
    : template.name ?? `${sourceModule} Template`
})

defineEmits<{
  loadWorkflow: [name: string]
}>()
</script>

<style lang="css" scoped>
.p-card {
  --p-card-body-padding: 10px 0 0 0;
  overflow: hidden;
}
</style>
