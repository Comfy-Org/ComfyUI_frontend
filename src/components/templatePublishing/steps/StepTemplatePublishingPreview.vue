<!--
  Step 6 of the template publishing wizard. Displays a read-only summary
  of all user-provided data so the author can audit it before submission.
-->
<template>
  <div class="flex flex-col gap-6 overflow-y-auto p-6">
    <!-- Metadata -->
    <PreviewSection
      :label="t('templatePublishing.steps.preview.sectionMetadata')"
      @edit="ctx.goToStep(2)"
    >
      <PreviewField
        :label="t('templatePublishing.steps.metadata.titleLabel')"
        :value="tpl.title"
      />
      <PreviewField
        :label="t('templatePublishing.steps.metadata.difficultyLabel')"
        :value="difficultyLabel"
      />
      <PreviewField
        :label="t('templatePublishing.steps.metadata.licenseLabel')"
        :value="licenseLabel"
      />
      <PreviewField
        :label="t('templatePublishing.steps.metadata.requiredNodesLabel')"
      >
        <ul
          v-if="(tpl.requiredNodes ?? []).length > 0"
          class="flex flex-col gap-0.5"
        >
          <li
            v-for="node in tpl.requiredNodes"
            :key="node"
            class="flex items-center gap-1.5 text-sm"
          >
            <i
              class="icon-[lucide--puzzle] h-3.5 w-3.5 text-muted-foreground"
            />
            {{ node }}
          </li>
        </ul>
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.noneDetected') }}
        </span>
      </PreviewField>
    </PreviewSection>

    <!-- Description -->
    <PreviewSection
      :label="t('templatePublishing.steps.preview.sectionDescription')"
      @edit="ctx.goToStep(3)"
    >
      <div
        v-if="tpl.description"
        class="prose prose-invert max-h-48 overflow-y-auto rounded-lg border border-border-default bg-secondary-background p-3 text-sm scrollbar-custom"
        v-html="renderedDescription"
      />
      <span v-else class="text-sm text-muted-foreground">
        {{ t('templatePublishing.steps.preview.notProvided') }}
      </span>
    </PreviewSection>

    <!-- Preview Assets -->
    <PreviewSection
      :label="t('templatePublishing.steps.preview.sectionPreviewAssets')"
      @edit="ctx.goToStep(4)"
    >
      <!-- Thumbnail -->
      <PreviewField
        :label="t('templatePublishing.steps.preview.thumbnailLabel')"
      >
        <img
          v-if="assets.thumbnail.value"
          :src="assets.thumbnail.value.objectUrl"
          :alt="assets.thumbnail.value.originalName"
          class="h-28 w-44 rounded-lg object-cover"
        />
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>

      <!-- Before & After -->
      <PreviewField
        :label="t('templatePublishing.steps.preview.comparisonLabel')"
      >
        <div
          v-if="assets.beforeImage.value || assets.afterImage.value"
          class="flex gap-3"
        >
          <div v-if="assets.beforeImage.value" class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground">
              {{
                t('templatePublishing.steps.previewGeneration.beforeImageLabel')
              }}
            </span>
            <img
              :src="assets.beforeImage.value.objectUrl"
              :alt="assets.beforeImage.value.originalName"
              class="h-24 w-24 rounded-lg object-cover"
            />
          </div>
          <div v-if="assets.afterImage.value" class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground">
              {{
                t('templatePublishing.steps.previewGeneration.afterImageLabel')
              }}
            </span>
            <img
              :src="assets.afterImage.value.objectUrl"
              :alt="assets.afterImage.value.originalName"
              class="h-24 w-24 rounded-lg object-cover"
            />
          </div>
        </div>
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>

      <!-- Workflow Graph -->
      <PreviewField
        :label="t('templatePublishing.steps.preview.workflowPreviewLabel')"
      >
        <img
          v-if="assets.workflowPreview.value"
          :src="assets.workflowPreview.value.objectUrl"
          :alt="assets.workflowPreview.value.originalName"
          class="h-28 w-48 rounded-lg object-cover"
        />
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>

      <!-- Video Preview -->
      <PreviewField
        :label="t('templatePublishing.steps.preview.videoPreviewLabel')"
      >
        <video
          v-if="assets.videoPreview.value"
          :src="assets.videoPreview.value.objectUrl"
          controls
          class="h-28 w-48 rounded-lg"
        />
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>

      <!-- Gallery -->
      <PreviewField :label="t('templatePublishing.steps.preview.galleryLabel')">
        <div
          v-if="assets.galleryImages.value.length > 0"
          class="flex flex-wrap gap-2"
        >
          <img
            v-for="(img, i) in assets.galleryImages.value"
            :key="img.originalName + i"
            :src="img.objectUrl"
            :alt="img.originalName"
            class="h-20 w-20 rounded-lg object-cover"
          />
        </div>
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>
    </PreviewSection>

    <!-- Categories & Tags -->
    <PreviewSection
      :label="t('templatePublishing.steps.preview.sectionCategoriesAndTags')"
      @edit="ctx.goToStep(5)"
    >
      <PreviewField
        :label="t('templatePublishing.steps.metadata.categoryLabel')"
      >
        <div
          v-if="(tpl.categories ?? []).length > 0"
          class="flex flex-wrap gap-1"
        >
          <span
            v-for="cat in tpl.categories"
            :key="cat"
            class="rounded-full bg-comfy-input-background px-2 py-0.5 text-xs"
          >
            {{ categoryDisplayName(cat) }}
          </span>
        </div>
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>

      <PreviewField :label="t('templatePublishing.steps.metadata.tagsLabel')">
        <div v-if="(tpl.tags ?? []).length > 0" class="flex flex-wrap gap-1">
          <span
            v-for="tag in tpl.tags"
            :key="tag"
            class="rounded-full bg-comfy-input-background px-2 py-0.5 text-xs"
          >
            {{ tag }}
          </span>
        </div>
        <span v-else class="text-sm text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </PreviewField>
    </PreviewSection>

    <!-- Correct button -->
    <div class="flex justify-end pt-2">
      <Button size="lg" @click="ctx.nextStep()">
        <i class="icon-[lucide--check] mr-1" />
        {{ t('templatePublishing.steps.preview.correct') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LicenseType } from '@/types/templateMarketplace'

import Button from '@/components/ui/button/Button.vue'
import { useTemplatePreviewAssets } from '@/composables/useTemplatePreviewAssets'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import { PublishingStepperKey } from '../types'
import PreviewField from './preview/PreviewField.vue'
import PreviewSection from './preview/PreviewSection.vue'

const { t } = useI18n()
const ctx = inject(PublishingStepperKey)!
const assets = useTemplatePreviewAssets()

const tpl = computed(() => ctx.template.value)

const renderedDescription = computed(() =>
  renderMarkdownToHtml(tpl.value.description ?? '')
)

const CATEGORY_KEY_MAP: Record<string, string> = {
  '3d': 'threeD',
  audio: 'audio',
  controlnet: 'controlNet',
  'image-generation': 'imageGeneration',
  inpainting: 'inpainting',
  other: 'other',
  'style-transfer': 'styleTransfer',
  text: 'text',
  upscaling: 'upscaling',
  'video-generation': 'videoGeneration'
}

function categoryDisplayName(value: string): string {
  const key = CATEGORY_KEY_MAP[value]
  if (!key) return value
  return t(`templatePublishing.steps.metadata.category.${key}`)
}

const LICENSE_KEY_MAP: Record<string, string> = {
  mit: 'mit',
  'cc-by': 'ccBy',
  'cc-by-sa': 'ccBySa',
  'cc-by-nc': 'ccByNc',
  apache: 'apache',
  custom: 'custom'
}

const licenseLabel = computed(() => {
  const license = tpl.value.license
  if (!license) return t('templatePublishing.steps.preview.notProvided')
  const key = LICENSE_KEY_MAP[license as LicenseType]
  if (!key) return license
  return t(`templatePublishing.steps.metadata.license.${key}`)
})

const difficultyLabel = computed(() => {
  const difficulty = tpl.value.difficulty
  if (!difficulty) return t('templatePublishing.steps.preview.notProvided')
  return t(`templatePublishing.steps.metadata.difficulty.${difficulty}`)
})
</script>
