<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.mediaMode.label') }}
      </label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="variant in variants"
          :key="variant.value"
          :class="
            cn(
              'flex flex-col items-center gap-1 rounded-lg border border-border-default p-3 text-xs transition-colors',
              selectedVariant === variant.value
                ? 'border-primary-background bg-primary-background/10'
                : 'hover:bg-secondary-background'
            )
          "
          @click="selectVariant(variant.value)"
        >
          <i :class="cn(variant.icon, 'size-5')" />
          {{ variant.label }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.mediaUpload') }}
      </label>
      <p class="text-xs text-muted">{{ uploadHint }}</p>

      <MediaSuggestions
        :label="t('templateWorkflows.publish.mediaSuggestionsOutputs')"
        :assets="outputImageAssets"
        :selected-urls="wizardData.gallery ?? []"
        @select="onSuggestionSelected"
      />
      <MediaSuggestions
        :label="t('templateWorkflows.publish.mediaSuggestionsInputs')"
        :assets="inputImageAssets"
        :selected-urls="wizardData.gallery ?? []"
        @select="onSuggestionSelected"
      />

      <component
        :is="uploadComponent"
        :files="wizardData.gallery ?? []"
        @add="onFileAdded"
        @remove="onFileRemoved"
      />

      <span v-if="errors.fileCount" class="text-xs text-destructive-background">
        {{ errors.fileCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { cn } from '@/utils/tailwindUtil'

import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'
import { mediaStepSchema } from '../schemas/templateSchema'
import { uploadMedia } from '../services/mediaApi'

import MediaSuggestions from './media/MediaSuggestions.vue'
import MediaUploadCompare from './media/MediaUploadCompare.vue'
import MediaUploadImages from './media/MediaUploadImages.vue'
import MediaUploadVideo from './media/MediaUploadVideo.vue'

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

function isImageAsset(asset: AssetItem): boolean {
  if (!asset.preview_url) return false
  if (asset.mime_type) return asset.mime_type.startsWith('image/')
  return IMAGE_EXTENSIONS.test(asset.name)
}

const { t } = useI18n()
const { wizardData } = usePublishTemplateWizard()
const assetsStore = useAssetsStore()

const outputImageAssets = computed(() =>
  assetsStore.historyAssets.filter(isImageAsset)
)
const inputImageAssets = computed(() =>
  assetsStore.inputAssets.filter(isImageAsset)
)

onMounted(() => {
  assetsStore.updateHistory()
  assetsStore.updateInputs()
})

const errors = ref<Record<string, string>>({})
const selectedVariant = ref<string>(
  wizardData.value.thumbnailVariant ?? 'default'
)

function selectVariant(variant: string) {
  if (variant === selectedVariant.value) return
  selectedVariant.value = variant
  wizardData.value.thumbnailVariant = variant
  wizardData.value.gallery = []
}

const variants = [
  {
    value: 'default' as const,
    label: t('templateWorkflows.publish.mediaMode.gallery'),
    icon: 'icon-[lucide--images]'
  },
  {
    value: 'compareSlider' as const,
    label: t('templateWorkflows.publish.mediaMode.comparison'),
    icon: 'icon-[lucide--columns-2]'
  },
  {
    value: 'hoverDissolve' as const,
    label: t('templateWorkflows.publish.mediaMode.video'),
    icon: 'icon-[lucide--film]'
  }
]

const uploadComponent = computed(() => {
  switch (selectedVariant.value) {
    case 'default':
      return MediaUploadImages
    case 'compareSlider':
      return MediaUploadCompare
    case 'hoverDissolve':
      return MediaUploadVideo
    default:
      return undefined
  }
})

const uploadHint = computed(() => {
  if (selectedVariant.value === 'compareSlider')
    return t('templateWorkflows.publish.mediaUploadHintCompare')
  if (selectedVariant.value === 'hoverDissolve')
    return t('templateWorkflows.publish.mediaUploadHintVideo')
  return t('templateWorkflows.publish.mediaUploadHintImages')
})

function onSuggestionSelected(url: string) {
  const gallery = wizardData.value.gallery ?? []
  if (gallery.includes(url)) return
  wizardData.value.gallery = [...gallery, url]
}

async function onFileAdded(file: File) {
  const result = await uploadMedia('draft', file)
  wizardData.value.gallery = [...(wizardData.value.gallery ?? []), result.url]
}

function onFileRemoved(index: number) {
  wizardData.value.gallery = wizardData.value.gallery?.filter(
    (_: string, i: number) => i !== index
  )
}

function validate(): boolean {
  const result = mediaStepSchema.safeParse({
    thumbnailVariant: selectedVariant.value,
    fileCount: wizardData.value.gallery?.length ?? 0
  })
  if (result.success) {
    errors.value = {}
    wizardData.value.thumbnailVariant = selectedVariant.value
    return true
  }
  const map: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (!map[key]) map[key] = issue.message
  }
  errors.value = map
  return false
}

defineExpose({ validate })
</script>
