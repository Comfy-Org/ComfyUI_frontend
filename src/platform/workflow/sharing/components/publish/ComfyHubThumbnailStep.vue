<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6">
    <div class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground select-none">
        {{ $t('comfyHubPublish.selectAThumbnail') }}
      </span>
      <ToggleGroup
        type="single"
        :model-value="thumbnailType"
        class="grid w-full grid-cols-3 gap-4"
        @update:model-value="handleThumbnailTypeChange"
      >
        <ToggleGroupItem
          v-for="option in thumbnailOptions"
          :key="option.value"
          :value="option.value"
          class="flex h-auto w-full gap-2 rounded-sm bg-node-component-surface p-2 font-inter text-base-foreground data-[state=on]:bg-muted-background"
        >
          <i :class="cn('size-4', option.icon)" />
          <span class="text-center text-sm font-bold">
            {{ option.label }}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-base-foreground select-none">
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

      <template v-if="thumbnailType === 'imageComparison'">
        <div
          class="grid flex-1 grid-cols-1 grid-rows-1 place-content-center-safe overflow-hidden"
        >
          <div
            v-if="hasBothComparisonImages"
            ref="comparisonPreviewRef"
            class="relative col-span-full row-span-full cursor-crosshair overflow-hidden rounded-lg"
          >
            <img
              :src="comparisonPreviewUrls.after!"
              :alt="$t('comfyHubPublish.uploadComparisonAfterPrompt')"
              class="size-full object-contain"
            />
            <img
              :src="comparisonPreviewUrls.before!"
              :alt="$t('comfyHubPublish.uploadComparisonBeforePrompt')"
              class="absolute inset-0 size-full object-contain"
              :style="{
                clipPath: `inset(0 ${100 - previewSliderPosition}% 0 0)`
              }"
            />
            <div
              class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm"
              :style="{ left: `${previewSliderPosition}%` }"
            />
          </div>

          <div
            :class="
              cn(
                'col-span-full row-span-full flex items-center-safe justify-center-safe gap-2',
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
                  'flex aspect-square h-full min-h-0 flex-[0_1_auto] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors',
                  comparisonPreviewUrls[slot.key]
                    ? 'self-start'
                    : 'flex-[0_1_1]',
                  comparisonOverStates[slot.key]
                    ? 'border-muted-foreground'
                    : 'border-border-default hover:border-muted-foreground'
                )
              "
              @dragenter.stop
              @dragleave.stop
              @dragover.prevent.stop
              @drop.prevent.stop
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

      <template v-else>
        <label
          ref="singleDropRef"
          :class="
            cn(
              'm-auto flex aspect-square min-h-0 w-full max-w-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors',
              thumbnailPreviewUrl ? 'self-center p-1' : 'flex-1',
              isOverSingleDrop
                ? 'border-muted-foreground'
                : 'border-border-default hover:border-muted-foreground'
            )
          "
          @dragenter.stop
          @dragleave.stop
          @dragover.prevent.stop
          @drop.prevent.stop
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
              :aria-label="$t('comfyHubPublish.videoPreview')"
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSliderFromMouse } from '@/platform/workflow/sharing/composables/useSliderFromMouse'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import {
  isFileTooLarge,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB
} from '@/platform/workflow/sharing/utils/validateFileSize'
import { cn } from '@/utils/tailwindUtil'
import { useDropZone, useObjectUrl } from '@vueuse/core'
import { computed, reactive, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { thumbnailType = 'image' } = defineProps<{
  thumbnailType?: ThumbnailType
}>()

const emit = defineEmits<{
  'update:thumbnailType': [value: ThumbnailType]
  'update:thumbnailFile': [value: File | null]
  'update:comparisonBeforeFile': [value: File | null]
  'update:comparisonAfterFile': [value: File | null]
}>()

const { t } = useI18n()

function isThumbnailType(value: string): value is ThumbnailType {
  return value === 'image' || value === 'video' || value === 'imageComparison'
}

function handleThumbnailTypeChange(value: unknown) {
  if (typeof value === 'string' && isThumbnailType(value)) {
    comparisonBeforeFile.value = null
    comparisonAfterFile.value = null
    emit('update:thumbnailFile', null)
    emit('update:comparisonBeforeFile', null)
    emit('update:comparisonAfterFile', null)
    emit('update:thumbnailType', value)
  }
}

const uploadSectionLabel = computed(() => {
  if (thumbnailType === 'video') return t('comfyHubPublish.uploadVideo')
  if (thumbnailType === 'imageComparison') {
    return t('comfyHubPublish.uploadComparison')
  }
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
    icon: 'icon-[lucide--image]'
  },
  {
    value: 'video' as const,
    label: t('comfyHubPublish.thumbnailVideo'),
    icon: 'icon-[lucide--video]'
  },
  {
    value: 'imageComparison' as const,
    label: t('comfyHubPublish.thumbnailImageComparison'),
    icon: 'icon-[lucide--diff]'
  }
]

const thumbnailFile = shallowRef<File | null>(null)
const thumbnailPreviewUrl = useObjectUrl(thumbnailFile)
const isVideoFile = ref(false)

function setThumbnailPreview(file: File) {
  const maxSize = file.type.startsWith('video/')
    ? MAX_VIDEO_SIZE_MB
    : MAX_IMAGE_SIZE_MB
  if (isFileTooLarge(file, maxSize)) return
  thumbnailFile.value = file
  isVideoFile.value = file.type.startsWith('video/')
  emit('update:thumbnailFile', file)
}

const comparisonBeforeFile = shallowRef<File | null>(null)
const comparisonAfterFile = shallowRef<File | null>(null)
const comparisonPreviewUrls = reactive({
  before: useObjectUrl(comparisonBeforeFile),
  after: useObjectUrl(comparisonAfterFile)
})

const hasBothComparisonImages = computed(
  () => !!(comparisonPreviewUrls.before && comparisonPreviewUrls.after)
)

const comparisonPreviewRef = ref<HTMLElement | null>(null)
const previewSliderPosition = useSliderFromMouse(comparisonPreviewRef)

const hasThumbnailContent = computed(() => {
  if (thumbnailType === 'imageComparison') {
    return !!(comparisonPreviewUrls.before || comparisonPreviewUrls.after)
  }
  return !!thumbnailPreviewUrl.value
})

function clearAllPreviews() {
  if (thumbnailType === 'imageComparison') {
    comparisonBeforeFile.value = null
    comparisonAfterFile.value = null
    emit('update:comparisonBeforeFile', null)
    emit('update:comparisonAfterFile', null)
    return
  }

  thumbnailFile.value = null
  emit('update:thumbnailFile', null)
}

function handleFileSelect(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  if (file) setThumbnailPreview(file)
}

const singleDropRef = ref<HTMLElement | null>(null)

function isImageType(types: readonly string[]) {
  return types.some((type) => type.startsWith('image/'))
}

function isVideoModeMedia(types: readonly string[]) {
  return types.some(
    (type) =>
      type.startsWith('video/') || type === 'image/gif' || type === 'image/webp'
  )
}

const { isOverDropZone: isOverSingleDrop } = useDropZone(singleDropRef, {
  dataTypes: (types: readonly string[]) =>
    thumbnailType === 'video' ? isVideoModeMedia(types) : isImageType(types),
  multiple: false,
  onDrop(files) {
    const file = files?.[0]
    if (file) {
      setThumbnailPreview(file)
    }
  }
})

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

const comparisonFiles: Record<ComparisonSlot, typeof comparisonBeforeFile> = {
  before: comparisonBeforeFile,
  after: comparisonAfterFile
}

function setComparisonPreview(file: File, slot: ComparisonSlot) {
  if (isFileTooLarge(file, MAX_IMAGE_SIZE_MB)) return
  comparisonFiles[slot].value = file
  if (slot === 'before') {
    emit('update:comparisonBeforeFile', file)
    return
  }
  emit('update:comparisonAfterFile', file)
}

function handleComparisonSelect(event: Event, slot: ComparisonSlot) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  if (file) setComparisonPreview(file, slot)
}

const comparisonDropRefs = reactive<Record<ComparisonSlot, HTMLElement | null>>(
  { before: null, after: null }
)
function useComparisonDropZone(slot: ComparisonSlot) {
  return useDropZone(
    computed(() => comparisonDropRefs[slot]),
    {
      dataTypes: isImageType,
      multiple: false,
      onDrop(files) {
        const file = files?.[0]
        if (file) setComparisonPreview(file, slot)
      }
    }
  )
}

const { isOverDropZone: isOverBefore } = useComparisonDropZone('before')
const { isOverDropZone: isOverAfter } = useComparisonDropZone('after')

const comparisonOverStates = computed(() => ({
  before: isOverBefore.value,
  after: isOverAfter.value
}))
</script>
