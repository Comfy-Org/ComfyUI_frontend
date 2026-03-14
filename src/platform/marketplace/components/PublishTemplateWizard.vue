<template>
  <BaseModalLayout size="md">
    <template #header>
      <h2>
        {{
          readOnly
            ? $t('marketplace.templateDetails')
            : $t('marketplace.publishToMarketplace')
        }}
      </h2>
    </template>

    <template #content>
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="flex flex-col gap-4">
            <PublishTemplateWizardStepDetails
              v-if="currentStep === 1"
              v-model:title="form.title"
              v-model:description="form.description"
              v-model:short-description="form.shortDescription"
              v-model:license="form.license"
              v-model:difficulty="form.difficulty"
              v-model:tags="form.tags"
              :read-only="readOnly"
              :thumbnail-url="thumbnailUrl"
              :license-options="licenseOptions"
              :license-label="licenseLabel"
              :difficulty-options="difficultyOptions"
              :difficulty-label="difficultyLabel"
              :is-uploading-thumbnail="isUploadingThumbnail"
              :thumbnail-upload-progress="thumbnailUploadProgress"
              :thumbnail-upload-complete="thumbnailUploadComplete"
              @thumbnail-selected="(file) => void processThumbnailFile(file)"
            />

            <PublishTemplateWizardStepSubmit
              v-if="currentStep === 2"
              :form="form"
              :submitted="submitted"
              :license-label="licenseLabel"
              :difficulty-label="difficultyLabel"
              :thumbnail-url="thumbnailUrl"
            />
          </div>
        </div>

        <PublishTemplateWizardFooter
          class="shrink-0"
          :error="publishingError"
          :read-only="readOnly"
          :current-step="currentStep"
          :submitted="submitted"
          :is-pending-review="isPendingReview"
          :can-advance="canAdvance"
          :is-publishing="isPublishing"
          @close="handleClose"
          @back="handleBack"
          @next="handleNext"
          @preview="handlePreview"
          @submit="handleSubmit"
        />
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import PublishTemplateWizardFooter from '@/platform/marketplace/components/PublishTemplateWizardFooter.vue'
import PublishTemplateWizardStepDetails from '@/platform/marketplace/components/PublishTemplateWizardStepDetails.vue'
import PublishTemplateWizardStepSubmit from '@/platform/marketplace/components/PublishTemplateWizardStepSubmit.vue'
import { createGraphThumbnail } from '@/renderer/core/thumbnail/graphThumbnailRenderer'
import type {
  DifficultyLevel,
  LicenseType,
  MarketplaceTemplate
} from '@/platform/marketplace/apiTypes'
import {
  DIFFICULTY_LEVELS,
  LICENSE_TYPES
} from '@/platform/marketplace/apiTypes'
import { useMarketplacePublishing } from '@/platform/marketplace/composables/useMarketplacePublishing'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { OnCloseKey } from '@/types/widgetTypes'

const {
  onClose,
  initialTemplate,
  readOnly = false
} = defineProps<{
  onClose?: () => void
  initialTemplate?: MarketplaceTemplate
  readOnly?: boolean
}>()

provide(OnCloseKey, onClose ?? (() => {}))

const { t } = useI18n()

const defaultPlaceholders = {
  title: t('marketplace.titlePlaceholder'),
  description: t('marketplace.descriptionPlaceholder'),
  shortDescription: t('marketplace.shortDescriptionPlaceholder')
}

const {
  currentStep,
  draftId,
  isPublishing,
  error: publishingError,
  createDraft,
  saveDraft,
  submit,
  uploadMedia,
  nextStep,
  prevStep,
  loadForEdit,
  loadCategories
} = useMarketplacePublishing()

const form = reactive({
  title: defaultPlaceholders.title,
  description: defaultPlaceholders.description,
  shortDescription: defaultPlaceholders.shortDescription,
  license: 'mit' as LicenseType,
  difficulty: 'beginner' as DifficultyLevel,
  tags: [] as string[]
})

const licenseOptions = computed(() =>
  LICENSE_TYPES.map((value) => ({
    name: t(`marketplace.licenseTypes.${value}`),
    value
  }))
)

const licenseLabel = computed(() =>
  t(`marketplace.licenseTypes.${form.license}`)
)

const difficultyOptions = computed(() =>
  DIFFICULTY_LEVELS.map((value) => ({
    name: t(`marketplace.difficultyLevels.${value}`),
    value
  }))
)

const difficultyLabel = computed(() =>
  t(`marketplace.difficultyLevels.${form.difficulty}`)
)

const submitted = ref(false)
const thumbnailUrl = ref<string | null>(null)
const pendingThumbnailFile = ref<File | null>(null)
const isUploadingThumbnail = ref(false)
const thumbnailUploadProgress = ref<number | null>(null)
const thumbnailUploadComplete = ref(false)

const isPendingReview = computed(
  () => initialTemplate?.status === 'pending_review'
)

const canAdvance = computed(() => {
  if (currentStep.value === 1) {
    return (
      form.title.trim() !== '' &&
      form.title !== defaultPlaceholders.title &&
      form.description.trim() !== '' &&
      form.description !== defaultPlaceholders.description &&
      form.shortDescription.trim() !== '' &&
      form.shortDescription !== defaultPlaceholders.shortDescription &&
      !!form.difficulty
    )
  }
  return true
})

function initFromTemplate(template: MarketplaceTemplate) {
  loadForEdit(template)
  form.title = template.title
  form.description = template.description
  form.shortDescription = template.shortDescription
  form.license = template.license
  form.difficulty = template.difficulty
  form.tags = template.tags ? [...template.tags] : []
  thumbnailUrl.value = template.thumbnail ?? null
}

watch(
  () => initialTemplate,
  (template) => {
    if (template) initFromTemplate(template)
  },
  { immediate: true }
)

onMounted(() => {
  void loadCategories()
})

async function handleNext() {
  if (currentStep.value === 1) {
    if (!draftId.value) {
      await createDraft({
        title: form.title,
        description: form.description,
        shortDescription: form.shortDescription,
        license: form.license,
        difficulty: form.difficulty,
        tags: form.tags
      })
      const file = pendingThumbnailFile.value
      if (file) {
        pendingThumbnailFile.value = null
        isUploadingThumbnail.value = true
        thumbnailUploadProgress.value = 0
        try {
          const media = await uploadMedia(file, {
            onProgress: (p) => {
              thumbnailUploadProgress.value = p
            }
          })
          if (media) {
            await saveDraft({ thumbnail: media.url })
            thumbnailUrl.value = media.url
          }
        } catch (err) {
          console.error('uploading thumbnail failed', err)
          useToastStore().addAlert(t('marketplace.thumbnailUploadError'))
        } finally {
          isUploadingThumbnail.value = false
          thumbnailUploadProgress.value = null
        }
      }
      nextStep()
    } else {
      await saveDraft({
        title: form.title,
        description: form.description,
        shortDescription: form.shortDescription,
        license: form.license,
        difficulty: form.difficulty,
        tags: form.tags,
        ...(thumbnailUrl.value?.startsWith('http') && {
          thumbnail: thumbnailUrl.value
        })
      })
      nextStep()
    }
  } else {
    nextStep()
  }
}

function handleBack() {
  prevStep()
}

function handlePreview() {
  nextStep()
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/data:([^;]+)/)
  const mimeType = mimeMatch?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], filename, { type: mimeType })
}

async function captureWorkflowPreview(): Promise<File | null> {
  const canvas = document.querySelector('.minimap-canvas') as HTMLCanvasElement
  if (canvas?.width && canvas?.height) {
    try {
      const dataUrl = canvas.toDataURL('image/png')
      return dataUrlToFile(dataUrl, 'workflow-preview.png')
    } catch {
      // Fall back to programmatic render if DOM canvas fails
    }
  }
  const dataUrl = createGraphThumbnail()
  if (!dataUrl) return null
  return dataUrlToFile(dataUrl, 'workflow-preview.png')
}

async function handleSubmit() {
  const previewFile = await captureWorkflowPreview()
  if (previewFile) {
    try {
      const media = await uploadMedia(previewFile, { type: 'preview' })
      if (media) {
        await saveDraft({ workflowPreview: media.url })
      }
    } catch (err) {
      console.error('uploading workflow preview failed', err)
    }
  }

  const result = await submit()
  if (result?.status === 'pending_review') {
    submitted.value = true
    onClose?.()
  }
}

function handleClose() {
  onClose?.()
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function processThumbnailFile(imageFile: File) {
  try {
    thumbnailUrl.value = await fileToDataUrl(imageFile)
  } catch {
    thumbnailUrl.value = URL.createObjectURL(imageFile)
  }

  if (!draftId.value) {
    await createDraft({
      title: form.title,
      description: form.description,
      shortDescription: form.shortDescription,
      license: form.license,
      difficulty: form.difficulty,
      tags: form.tags
    })
    if (!draftId.value) {
      pendingThumbnailFile.value = imageFile
      useToastStore().addAlert(
        publishingError.value ?? t('marketplace.thumbnailUploadError')
      )
      return
    }
  }

  pendingThumbnailFile.value = null
  isUploadingThumbnail.value = true
  thumbnailUploadProgress.value = 0
  try {
    const media = await uploadMedia(imageFile, {
      onProgress: (p) => {
        thumbnailUploadProgress.value = p
      }
    })
    if (media) {
      await saveDraft({ thumbnail: media.url })
      thumbnailUrl.value = media.url
      thumbnailUploadComplete.value = true
    }
  } catch (err) {
    console.error('uploading thumbnail failed', err)
    useToastStore().addAlert(t('marketplace.thumbnailUploadError'))
  } finally {
    isUploadingThumbnail.value = false
    thumbnailUploadProgress.value = null
  }
}
</script>
