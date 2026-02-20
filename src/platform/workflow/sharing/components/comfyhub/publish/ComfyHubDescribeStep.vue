<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <!-- Workflow name -->
    <label class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.workflowName') }}
      </span>
      <Input
        :model-value="name"
        :placeholder="$t('comfyHubPublish.workflowNamePlaceholder')"
        @update:model-value="$emit('update:name', String($event))"
      />
    </label>

    <!-- Workflow description -->
    <label class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.workflowDescription') }}
      </span>
      <Textarea
        :model-value="description"
        :placeholder="$t('comfyHubPublish.workflowDescriptionPlaceholder')"
        rows="4"
        @update:model-value="$emit('update:description', String($event))"
      />
    </label>

    <!-- Thumbnail type -->
    <div class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.thumbnailType') }}
      </span>
      <div class="flex gap-4">
        <button
          v-for="option in thumbnailOptions"
          :key="option.value"
          :class="
            cn(
              'flex flex-1 cursor-pointer items-center gap-2 rounded border-none p-2',
              thumbnailType === option.value
                ? 'bg-muted-background'
                : 'bg-node-component-surface'
            )
          "
          @click="$emit('update:thumbnailType', option.value)"
        >
          <div
            :ref="
              option.overlayImage
                ? (el) => (compareContainerRef = el as HTMLElement)
                : undefined
            "
            class="relative aspect-square w-1/2 overflow-hidden rounded-sm"
          >
            <img
              :src="option.image"
              :alt="option.label"
              class="h-full w-full object-cover"
            />
            <template v-if="option.overlayImage">
              <img
                :src="option.overlayImage"
                :alt="option.label"
                class="absolute inset-0 h-full w-full object-cover"
                :style="{
                  clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)`
                }"
              />
              <div
                class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm"
                :style="{ left: `${compareSliderPosition}%` }"
              />
            </template>
          </div>
          <span
            class="w-1/2 text-center text-sm font-bold text-base-foreground"
          >
            {{ option.label }}
          </span>
        </button>
      </div>
    </div>

    <!-- Upload thumbnail / video / comparison -->
    <div class="flex min-h-0 flex-1 shrink flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">
          {{ uploadSectionLabel }}
        </span>
        <Button
          v-if="hasThumbnailContent"
          variant="muted-textonly"
          size="sm"
          @click="clearAllPreviews"
        >
          {{ $t('g.clear') }}
        </Button>
      </div>

      <!-- Comparison: before/after drop zones or preview -->
      <template v-if="thumbnailType === 'imageComparison'">
        <!-- Comparison preview slider (when both images provided) -->
        <div
          class="flex-1 grid grid-cols-1 grid-rows-1 place-content-center-safe"
        >
          <div
            v-if="hasBothComparisonImages"
            ref="comparisonPreviewRef"
            class="relative cursor-crosshair overflow-hidden rounded-lg col-span-full row-span-full"
          >
            <img
              :src="comparisonPreviewUrls.after!"
              :alt="$t('comfyHubPublish.uploadComparisonAfterPrompt')"
              class="h-full w-full object-contain"
            />
            <img
              :src="comparisonPreviewUrls.before!"
              :alt="$t('comfyHubPublish.uploadComparisonBeforePrompt')"
              class="absolute inset-0 h-full w-full object-contain"
              :style="{
                clipPath: `inset(0 ${100 - previewSliderPosition}% 0 0)`
              }"
            />
            <div
              class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm"
              :style="{ left: `${previewSliderPosition}%` }"
            />
          </div>

          <!-- Drop zones (when either image is missing) -->
          <div
            :class="
              cn(
                'flex gap-2 col-span-full row-span-full',
                hasBothComparisonImages && 'invisible'
              )
            "
          >
            <label
              v-for="slot in comparisonSlots"
              :key="slot.key"
              :ref="(el) => (comparisonDropRefs[slot.key] = el as HTMLElement)"
              :class="
                cn(
                  'flex max-w-1/2 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors',
                  comparisonPreviewUrls[slot.key] ? 'self-start' : 'flex-1',
                  comparisonOverStates[slot.key]
                    ? 'border-muted-foreground'
                    : 'border-border-default hover:border-muted-foreground'
                )
              "
            >
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="(e) => handleComparisonSelect(e, slot.key)"
              />
              <template v-if="comparisonPreviewUrls[slot.key]">
                <img
                  :src="comparisonPreviewUrls[slot.key]!"
                  :alt="slot.label"
                  class="max-h-full max-w-full object-contain"
                />
              </template>
              <template v-else>
                <span class="text-sm font-medium text-muted-foreground">
                  {{ slot.label }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ $t('comfyHubPublish.uploadThumbnailHint') }}
                </span>
              </template>
            </label>
          </div>
        </div>
      </template>

      <!-- Single file: image or video -->
      <template v-else>
        <label
          ref="singleDropRef"
          :class="
            cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors',
              thumbnailPreviewUrl ? 'self-center p-1' : 'flex-1',
              isOverSingleDrop
                ? 'border-muted-foreground'
                : 'border-border-default hover:border-muted-foreground'
            )
          "
        >
          <input
            type="file"
            :accept="
              thumbnailType === 'video'
                ? 'video/*,image/gif,image/webp'
                : 'image/*'
            "
            class="hidden"
            @change="handleFileSelect"
          />
          <template v-if="thumbnailPreviewUrl">
            <video
              v-if="isVideoFile"
              :src="thumbnailPreviewUrl"
              class="max-h-full max-w-full object-contain"
              muted
              loop
              autoplay
            />
            <img
              v-else
              :src="thumbnailPreviewUrl"
              :alt="$t('comfyHubPublish.thumbnailPreview')"
              class="max-h-full max-w-full object-contain"
            />
          </template>
          <template v-else>
            <span class="text-sm text-muted-foreground">
              {{ $t('comfyHubPublish.uploadPromptClickToBrowse') }}
            </span>
            <span class="text-sm text-muted-foreground">
              {{ uploadDropText }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ $t('comfyHubPublish.uploadThumbnailHint') }}
            </span>
          </template>
        </label>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { cn } from '@/utils/tailwindUtil'
import { useDropZone, useMouseInElement } from '@vueuse/core'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { thumbnailType } = defineProps<{
  name: string
  description: string
  thumbnailType: ThumbnailType
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:description': [value: string]
  'update:thumbnailType': [value: ThumbnailType]
  'update:thumbnailFile': [value: File]
  'update:comparisonBeforeFile': [value: File]
  'update:comparisonAfterFile': [value: File]
}>()

const { t } = useI18n()

const uploadSectionLabel = computed(() => {
  if (thumbnailType === 'video') return t('comfyHubPublish.uploadVideo')
  if (thumbnailType === 'imageComparison')
    return t('comfyHubPublish.uploadComparison')
  return t('comfyHubPublish.uploadThumbnail')
})

const uploadDropText = computed(() =>
  thumbnailType === 'video'
    ? t('comfyHubPublish.uploadPromptDropVideo')
    : t('comfyHubPublish.uploadPromptDropImage')
)

const thumbnailOptions = [
  {
    value: 'image' as const,
    label: t('comfyHubPublish.thumbnailImage'),
    image: '/assets/images/comfyhub/type_image.png'
  },
  {
    value: 'video' as const,
    label: t('comfyHubPublish.thumbnailVideo'),
    image: '/assets/images/comfyhub/type_video.gif'
  },
  {
    value: 'imageComparison' as const,
    label: t('comfyHubPublish.thumbnailImageComparison'),
    image: '/assets/images/comfyhub/type_compare_b.png',
    overlayImage: '/assets/images/comfyhub/type_compare_a.png'
  }
]

const thumbnailPreviewUrl = ref<string | null>(null)
const isVideoFile = ref(false)

onBeforeUnmount(() => {
  if (thumbnailPreviewUrl.value) {
    URL.revokeObjectURL(thumbnailPreviewUrl.value)
  }
})

const compareSliderPosition = ref(50)
const compareContainerRef = ref<HTMLElement | null>(null)
const { elementX, elementWidth, isOutside } =
  useMouseInElement(compareContainerRef)

watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    compareSliderPosition.value = (x / width) * 100
  }
})

function setThumbnailPreview(file: File) {
  if (thumbnailPreviewUrl.value) {
    URL.revokeObjectURL(thumbnailPreviewUrl.value)
  }
  thumbnailPreviewUrl.value = URL.createObjectURL(file)
  isVideoFile.value = file.type.startsWith('video/')
  emit('update:thumbnailFile', file)
}

function clearThumbnailPreview() {
  if (thumbnailPreviewUrl.value) {
    URL.revokeObjectURL(thumbnailPreviewUrl.value)
    thumbnailPreviewUrl.value = null
  }
}

const hasBothComparisonImages = computed(
  () => !!(comparisonPreviewUrls.before && comparisonPreviewUrls.after)
)

const comparisonPreviewRef = ref<HTMLElement | null>(null)
const previewSliderPosition = ref(50)
const {
  elementX: previewX,
  elementWidth: previewWidth,
  isOutside: previewIsOutside
} = useMouseInElement(comparisonPreviewRef)

watch([previewX, previewWidth, previewIsOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    previewSliderPosition.value = (x / width) * 100
  }
})

const hasThumbnailContent = computed(() => {
  if (thumbnailType === 'imageComparison') {
    return !!(comparisonPreviewUrls.before || comparisonPreviewUrls.after)
  }
  return !!thumbnailPreviewUrl.value
})

function clearAllPreviews() {
  if (thumbnailType === 'imageComparison') {
    for (const slot of ['before', 'after'] as const) {
      if (comparisonPreviewUrls[slot]) {
        URL.revokeObjectURL(comparisonPreviewUrls[slot]!)
        comparisonPreviewUrls[slot] = null
      }
    }
  } else {
    clearThumbnailPreview()
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) setThumbnailPreview(file)
}

// Single drop zone
const singleDropRef = ref<HTMLElement | null>(null)

function isImageType(types: readonly string[]) {
  return types.some((type) => type.startsWith('image/'))
}

function isVideoType(types: readonly string[]) {
  return types.some(
    (type) => type.startsWith('video/') || type.startsWith('image/')
  )
}

const { isOverDropZone: isOverSingleDrop } = useDropZone(singleDropRef, {
  dataTypes: (types: readonly string[]) =>
    thumbnailType === 'video' ? isVideoType(types) : isImageType(types),
  multiple: false,
  onDrop(files) {
    const file = files?.[0]
    if (file) setThumbnailPreview(file)
  }
})

// Comparison before/after
type ComparisonSlot = 'before' | 'after'

const comparisonSlots = [
  {
    key: 'before' as const,
    label: t('comfyHubPublish.uploadComparisonBeforePrompt')
  },
  {
    key: 'after' as const,
    label: t('comfyHubPublish.uploadComparisonAfterPrompt')
  }
]

const comparisonPreviewUrls = reactive<Record<ComparisonSlot, string | null>>({
  before: null,
  after: null
})

onBeforeUnmount(() => {
  for (const url of Object.values(comparisonPreviewUrls)) {
    if (url) URL.revokeObjectURL(url)
  }
})

function setComparisonPreview(file: File, slot: ComparisonSlot) {
  if (comparisonPreviewUrls[slot]) {
    URL.revokeObjectURL(comparisonPreviewUrls[slot]!)
  }
  comparisonPreviewUrls[slot] = URL.createObjectURL(file)
  if (slot === 'before') {
    emit('update:comparisonBeforeFile', file)
  } else {
    emit('update:comparisonAfterFile', file)
  }
}

function handleComparisonSelect(event: Event, slot: ComparisonSlot) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) setComparisonPreview(file, slot)
}

const comparisonDropRefs = reactive<Record<ComparisonSlot, HTMLElement | null>>(
  { before: null, after: null }
)
const comparisonOverStates = reactive<Record<ComparisonSlot, boolean>>({
  before: false,
  after: false
})

const { isOverDropZone: isOverBefore } = useDropZone(
  computed(() => comparisonDropRefs.before),
  {
    dataTypes: isImageType,
    multiple: false,
    onDrop(files) {
      const file = files?.[0]
      if (file) setComparisonPreview(file, 'before')
    }
  }
)
const { isOverDropZone: isOverAfter } = useDropZone(
  computed(() => comparisonDropRefs.after),
  {
    dataTypes: isImageType,
    multiple: false,
    onDrop(files) {
      const file = files?.[0]
      if (file) setComparisonPreview(file, 'after')
    }
  }
)

watch([isOverBefore, isOverAfter], ([before, after]) => {
  comparisonOverStates.before = before
  comparisonOverStates.after = after
})
</script>
