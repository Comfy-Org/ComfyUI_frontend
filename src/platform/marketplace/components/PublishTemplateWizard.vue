<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <!-- <h2 class="text-lg font-semibold">
        {{ $t('marketplace.publishToMarketplace') }}
      </h2> -->
      <div class="ml-auto flex gap-2 text-sm text-muted">
        <span
          v-for="(step, idx) in steps"
          :key="step.id"
          :class="
            cn(
              'rounded-full px-3 py-1 select-none',
              currentStep === idx + 1
                ? 'text-highlight-foreground bg-highlight'
                : 'bg-base-background'
            )
          "
        >
          {{ step.label }}
        </span>
      </div>
    </div>

    <!-- Step 1: Details + Preview split view -->
    <div
      v-if="currentStep === 1"
      data-testid="step-details"
      class="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="publish-title" class="text-sm font-medium">
            {{ $t('marketplace.title') }}
          </label>
          <input
            id="publish-title"
            v-model="form.title"
            data-testid="input-title"
            type="text"
            class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="publish-description" class="text-sm font-medium">
            {{ $t('marketplace.description') }}
          </label>
          <textarea
            id="publish-description"
            v-model="form.description"
            data-testid="input-description"
            rows="4"
            class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="publish-short-description" class="text-sm font-medium">
            {{ $t('marketplace.shortDescription') }}
          </label>
          <input
            id="publish-short-description"
            v-model="form.shortDescription"
            data-testid="input-short-description"
            type="text"
            class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="publish-license" class="text-sm font-medium">
            {{ $t('marketplace.license') }}
          </label>
          <SingleSelect
            id="publish-license"
            v-model="form.license"
            :label="$t('marketplace.license')"
            :options="licenseOptions"
            data-testid="input-license"
            size="md"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">
            {{ $t('marketplace.tags') }}
          </label>
          <TagInputWithAutocomplete
            v-model="form.tags"
            :placeholder="$t('marketplace.tagsPlaceholder')"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-xs text-muted">
          {{ $t('marketplace.previewDescription') }}
        </p>
        <div
          class="flex w-full justify-center rounded-lg border border-border-default bg-base-background py-5"
        >
          <div class="w-full max-w-72">
            <MarketplaceTemplatePreviewCard
              :title="form.title"
              :short-description="form.shortDescription"
              :description="form.description"
              :license-label="licenseLabel"
              :tags="form.tags"
              :thumbnail-url="thumbnailUrl"
            >
              <template #thumbnail-placeholder>
                <div
                  class="relative flex size-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors"
                  :class="
                    cn(
                      'cursor-pointer border-border-default bg-dialog-surface hover:border-muted-foreground',
                      isOverThumbnailDrop && 'border-muted-foreground'
                    )
                  "
                  data-testid="preview-thumbnail-placeholder"
                  data-handles-file-drop
                  @dragover.prevent="handleThumbnailDragOver"
                  @dragleave="handleThumbnailDragLeave"
                  @drop.prevent="handleThumbnailDrop"
                >
                  <div
                    v-if="isUploadingThumbnail"
                    class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-base-background/80"
                  >
                    <i
                      class="icon-[lucide--loader-circle] size-10 animate-spin text-muted"
                      aria-hidden
                    />
                  </div>
                  <i class="icon-[lucide--image] size-10 text-muted" />
                  <span class="text-xs text-muted">
                    {{ $t('marketplace.dropThumbnailHere') }}
                  </span>
                </div>
              </template>
            </MarketplaceTemplatePreviewCard>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 2: Submit -->
    <div
      v-if="currentStep === 2"
      data-testid="step-submit"
      class="flex flex-col gap-4"
    >
      <div
        v-if="submitted"
        class="border-success bg-success/10 rounded-lg border p-4 text-sm"
      >
        {{ $t('marketplace.submitted') }}
      </div>
      <div v-else class="flex flex-col gap-2 text-sm">
        <p>{{ $t('marketplace.previewDescription') }}</p>
        <div class="flex justify-center">
          <div class="w-full max-w-72">
            <MarketplaceTemplatePreviewCard
              :title="form.title"
              :short-description="form.shortDescription"
              :description="form.description"
              :license-label="licenseLabel"
              :tags="form.tags"
              :thumbnail-url="thumbnailUrl"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <div
      v-if="error"
      class="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm"
    >
      {{ error }}
    </div>

    <!-- Navigation buttons -->
    <div class="flex justify-between pt-2">
      <Button
        v-if="currentStep > 1"
        data-testid="btn-back"
        variant="secondary"
        @click="handleBack"
      >
        {{ $t('marketplace.back') }}
      </Button>
      <div v-else />

      <div class="flex gap-2">
        <Button
          v-if="currentStep < 2"
          data-testid="btn-next"
          :disabled="!canAdvance"
          @click="handleNext"
        >
          {{ $t('marketplace.next') }}
        </Button>
        <Button
          v-if="currentStep === 2 && !submitted && isPendingReview"
          data-testid="btn-done"
          @click="handleDone"
        >
          {{ $t('marketplace.done') }}
        </Button>
        <Button
          v-if="currentStep === 2 && !submitted && !isPendingReview"
          data-testid="btn-submit"
          :disabled="isPublishing"
          @click="handleSubmit"
        >
          {{
            isPublishing
              ? $t('marketplace.submitting')
              : $t('marketplace.submitForReview')
          }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TagInputWithAutocomplete from '@/components/input/TagInputWithAutocomplete.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import Button from '@/components/ui/button/Button.vue'
import MarketplaceTemplatePreviewCard from '@/platform/marketplace/components/MarketplaceTemplatePreviewCard.vue'
import type {
  LicenseType,
  MarketplaceTemplate
} from '@/platform/marketplace/apiTypes'
import { LICENSE_TYPES } from '@/platform/marketplace/apiTypes'
import { useMarketplacePublishing } from '@/platform/marketplace/composables/useMarketplacePublishing'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { extractFilesFromDragEvent, hasImageType } from '@/utils/eventUtils'
import { cn } from '@/utils/tailwindUtil'

const { onClose, initialTemplate } = defineProps<{
  onClose?: () => void
  initialTemplate?: MarketplaceTemplate
}>()

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
  error,
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

const submitted = ref(false)
const thumbnailUrl = ref<string | null>(null)
const pendingThumbnailFile = ref<File | null>(null)
const isUploadingThumbnail = ref(false)
const isOverThumbnailDrop = ref(false)

const isPendingReview = computed(
  () => initialTemplate?.status === 'pending_review'
)

const steps = computed(() => [
  { id: 'details', label: t('marketplace.steps.details') },
  { id: 'submit', label: t('marketplace.steps.submit') }
])

const canAdvance = computed(() => {
  if (currentStep.value === 1) {
    return (
      form.title.trim() !== '' &&
      form.title !== defaultPlaceholders.title &&
      form.description.trim() !== '' &&
      form.description !== defaultPlaceholders.description &&
      form.shortDescription.trim() !== '' &&
      form.shortDescription !== defaultPlaceholders.shortDescription
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
        tags: form.tags
      })
      const file = pendingThumbnailFile.value
      if (file) {
        pendingThumbnailFile.value = null
        isUploadingThumbnail.value = true
        try {
          const media = await uploadMedia(file)
          if (media) {
            await saveDraft({ thumbnail: media.url })
            thumbnailUrl.value = media.url
          }
        } catch (err) {
          console.error('uploading thumbnail failed', err)
          useToastStore().addAlert(t('marketplace.thumbnailUploadError'))
        } finally {
          isUploadingThumbnail.value = false
        }
      }
      nextStep()
    } else {
      await saveDraft({
        title: form.title,
        description: form.description,
        shortDescription: form.shortDescription,
        license: form.license,
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

async function handleSubmit() {
  const result = await submit()
  if (result?.status === 'pending_review') {
    submitted.value = true
    onClose?.()
  }
}

function handleDone() {
  onClose?.()
}

function hasImageDropData(e: DragEvent): boolean {
  if (!e.dataTransfer) return false
  if (e.dataTransfer.files?.length) {
    return Array.from(e.dataTransfer.files).some(hasImageType)
  }
  return ['text/uri-list', 'text/x-moz-url'].some((t) =>
    e.dataTransfer!.types.includes(t)
  )
}

function handleThumbnailDragOver(e: DragEvent) {
  if (!hasImageDropData(e)) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
  isOverThumbnailDrop.value = true
}

function handleThumbnailDragLeave() {
  isOverThumbnailDrop.value = false
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function handleThumbnailDrop(e: DragEvent) {
  isOverThumbnailDrop.value = false
  e.preventDefault()
  e.stopPropagation()
  const files = await extractFilesFromDragEvent(e)
  const imageFile = files.find(hasImageType)
  if (!imageFile) {
    useToastStore().addAlert(t('marketplace.thumbnailUploadError'))
    return
  }
  try {
    thumbnailUrl.value = await fileToDataUrl(imageFile)
  } catch {
    thumbnailUrl.value = URL.createObjectURL(imageFile)
  }
  if (draftId.value) {
    pendingThumbnailFile.value = null
    isUploadingThumbnail.value = true
    try {
      const media = await uploadMedia(imageFile)
      if (media) {
        await saveDraft({ thumbnail: media.url })
        thumbnailUrl.value = media.url
      }
    } finally {
      isUploadingThumbnail.value = false
    }
  } else {
    pendingThumbnailFile.value = imageFile
  }
}
</script>
