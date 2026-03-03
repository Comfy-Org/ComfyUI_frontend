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

      <component
        :is="uploadComponent"
        :files="wizard.uploadedFiles.value"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'
import { mediaStepSchema } from '../schemas/templateSchema'
import { uploadMedia } from '../services/mediaApi'

import MediaUploadCompare from './media/MediaUploadCompare.vue'
import MediaUploadImages from './media/MediaUploadImages.vue'
import MediaUploadVideo from './media/MediaUploadVideo.vue'

type ThumbnailVariant = 'default' | 'compareSlider' | 'hoverDissolve'

const { t } = useI18n()
const wizard = usePublishTemplateWizard()

const errors = ref<Record<string, string>>({})

const selectedVariant = ref<ThumbnailVariant>(
  (wizard.wizardData.value.template?.thumbnailVariant as ThumbnailVariant) ??
    'default'
)

function ensureTemplate() {
  if (!wizard.wizardData.value.template) {
    wizard.wizardData.value.template = {
      name: '',
      description: '',
      mediaType: 'image',
      mediaSubtype: 'photo'
    }
  }
  return wizard.wizardData.value.template
}

function selectVariant(variant: ThumbnailVariant) {
  if (variant === selectedVariant.value) return
  selectedVariant.value = variant
  const tmpl = ensureTemplate()
  tmpl.thumbnailVariant = variant === 'default' ? undefined : variant
  tmpl.mediaType = 'image'
  tmpl.mediaSubtype = 'photo'
  wizard.uploadedFiles.value = []
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

const UPLOAD_COMPONENTS = {
  default: MediaUploadImages,
  compareSlider: MediaUploadCompare,
  hoverDissolve: MediaUploadVideo
} as const

const uploadComponent = computed(() => UPLOAD_COMPONENTS[selectedVariant.value])

const uploadHint = computed(() => {
  if (selectedVariant.value === 'compareSlider')
    return t('templateWorkflows.publish.mediaUploadHintCompare')
  if (selectedVariant.value === 'hoverDissolve')
    return t('templateWorkflows.publish.mediaUploadHintVideo')
  return t('templateWorkflows.publish.mediaUploadHintImages')
})

async function onFileAdded(file: File) {
  const result = await uploadMedia('draft', file)
  wizard.uploadedFiles.value = [...wizard.uploadedFiles.value, result.url]
}

function onFileRemoved(index: number) {
  wizard.uploadedFiles.value = wizard.uploadedFiles.value.filter(
    (_: string, i: number) => i !== index
  )
}

function validate(): boolean {
  const tmpl = wizard.wizardData.value.template
  const result = mediaStepSchema.safeParse({
    mediaType: tmpl?.mediaType ?? '',
    thumbnailVariant: selectedVariant.value,
    fileCount: wizard.uploadedFiles.value.length
  })
  if (result.success) {
    errors.value = {}
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
