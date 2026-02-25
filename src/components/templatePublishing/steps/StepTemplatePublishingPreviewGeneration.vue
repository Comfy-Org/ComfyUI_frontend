<!--
  Step 4 of the template publishing wizard. Collects preview assets:
  thumbnail, before/after comparison, workflow graph, optional video,
  and an optional gallery of up to six example output images.
-->
<template>
  <div class="flex flex-col gap-6 overflow-y-auto p-6">
    <!-- Thumbnail -->
    <section class="flex flex-col gap-1">
      <span class="text-sm font-medium text-muted">
        {{ t('templatePublishing.steps.previewGeneration.thumbnailLabel') }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{ t('templatePublishing.steps.previewGeneration.thumbnailHint') }}
      </span>
      <TemplateAssetUploadZone
        :asset="assets.thumbnail.value"
        size-class="h-40 w-64"
        @upload="onThumbnailUpload"
        @remove="onThumbnailRemove"
      />
    </section>

    <!-- Before & After Comparison -->
    <section class="flex flex-col gap-1">
      <span class="text-sm font-medium text-muted">
        {{ t('templatePublishing.steps.previewGeneration.comparisonLabel') }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{ t('templatePublishing.steps.previewGeneration.comparisonHint') }}
      </span>
      <div class="flex flex-row gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">
            {{
              t('templatePublishing.steps.previewGeneration.beforeImageLabel')
            }}
          </span>
          <TemplateAssetUploadZone
            :asset="assets.beforeImage.value"
            @upload="onBeforeUpload"
            @remove="onBeforeRemove"
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">
            {{
              t('templatePublishing.steps.previewGeneration.afterImageLabel')
            }}
          </span>
          <TemplateAssetUploadZone
            :asset="assets.afterImage.value"
            @upload="onAfterUpload"
            @remove="onAfterRemove"
          />
        </div>
      </div>
    </section>

    <!-- Workflow Graph Preview -->
    <section class="flex flex-col gap-1">
      <span class="text-sm font-medium text-muted">
        {{
          t('templatePublishing.steps.previewGeneration.workflowPreviewLabel')
        }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{
          t('templatePublishing.steps.previewGeneration.workflowPreviewHint')
        }}
      </span>
      <TemplateAssetUploadZone
        :asset="assets.workflowPreview.value"
        size-class="h-40 w-72"
        @upload="onWorkflowUpload"
        @remove="onWorkflowRemove"
      />
    </section>

    <!-- Video Preview (optional) -->
    <section class="flex flex-col gap-1">
      <span class="text-sm font-medium text-muted">
        {{ t('templatePublishing.steps.previewGeneration.videoPreviewLabel') }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{ t('templatePublishing.steps.previewGeneration.videoPreviewHint') }}
      </span>
      <TemplateAssetUploadZone
        :asset="assets.videoPreview.value"
        accept="video/*"
        preview-type="video"
        size-class="h-40 w-72"
        @upload="onVideoUpload"
        @remove="onVideoRemove"
      />
    </section>

    <!-- Example Output Gallery -->
    <section class="flex flex-col gap-1">
      <span class="text-sm font-medium text-muted">
        {{ t('templatePublishing.steps.previewGeneration.galleryLabel') }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{
          t('templatePublishing.steps.previewGeneration.galleryHint', {
            max: MAX_GALLERY_IMAGES
          })
        }}
      </span>
      <div class="flex flex-wrap gap-3">
        <div
          v-for="(asset, index) in assets.galleryImages.value"
          :key="asset.originalName + index"
          class="group relative h-28 w-28 overflow-hidden rounded-lg"
        >
          <img
            :src="asset.objectUrl"
            :alt="asset.originalName"
            class="h-full w-full object-cover"
          />
          <div
            class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span class="truncate text-[10px] text-white">
              {{ asset.originalName }}
            </span>
            <button
              type="button"
              class="shrink-0 text-white hover:text-danger"
              :aria-label="
                t('templatePublishing.steps.previewGeneration.removeFile')
              "
              @click="onGalleryRemove(index)"
            >
              <i class="icon-[lucide--x] h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          v-if="assets.galleryImages.value.length < MAX_GALLERY_IMAGES"
          class="flex h-28 w-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border-default hover:border-muted-foreground"
          role="button"
          :tabindex="0"
          :aria-label="
            t('templatePublishing.steps.previewGeneration.uploadPrompt')
          "
          @click="galleryInput?.click()"
          @keydown.enter="galleryInput?.click()"
        >
          <i class="icon-[lucide--plus] h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <input
        ref="galleryInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onGallerySelect"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import {
  MAX_GALLERY_IMAGES,
  useTemplatePreviewAssets
} from '@/composables/useTemplatePreviewAssets'

import { PublishingStepperKey } from '../types'
import TemplateAssetUploadZone from '../TemplateAssetUploadZone.vue'

const { t } = useI18n()
const ctx = inject(PublishingStepperKey)!
const assets = useTemplatePreviewAssets()
const galleryInput = ref<HTMLInputElement | null>(null)

function onThumbnailUpload(file: File) {
  ctx.template.value.thumbnail = assets.setThumbnail(file)
}

function onThumbnailRemove() {
  assets.clearThumbnail()
  ctx.template.value.thumbnail = ''
}

function onBeforeUpload(file: File) {
  ctx.template.value.beforeImage = assets.setBeforeImage(file)
}

function onBeforeRemove() {
  assets.clearBeforeImage()
  ctx.template.value.beforeImage = undefined
}

function onAfterUpload(file: File) {
  ctx.template.value.afterImage = assets.setAfterImage(file)
}

function onAfterRemove() {
  assets.clearAfterImage()
  ctx.template.value.afterImage = undefined
}

function onWorkflowUpload(file: File) {
  ctx.template.value.workflowPreview = assets.setWorkflowPreview(file)
}

function onWorkflowRemove() {
  assets.clearWorkflowPreview()
  ctx.template.value.workflowPreview = ''
}

function onVideoUpload(file: File) {
  ctx.template.value.videoPreview = assets.setVideoPreview(file)
}

function onVideoRemove() {
  assets.clearVideoPreview()
  ctx.template.value.videoPreview = undefined
}

function onGallerySelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files) return

  for (const file of files) {
    const url = assets.addGalleryImage(file)
    if (url) {
      const gallery = ctx.template.value.gallery ?? []
      ctx.template.value.gallery = [
        ...gallery,
        { type: 'image', url, caption: file.name }
      ]
    }
  }
  input.value = ''
}

function onGalleryRemove(index: number) {
  assets.removeGalleryImage(index)
  const gallery = ctx.template.value.gallery ?? []
  ctx.template.value.gallery = gallery.filter((_, i) => i !== index)
}

watchDebounced(
  () => ctx.template.value,
  () => ctx.saveDraft(),
  { deep: true, debounce: 500 }
)
</script>
