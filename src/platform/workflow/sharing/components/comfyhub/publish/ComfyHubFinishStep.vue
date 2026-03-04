<template>
  <div v-if="embedded" :class="containerClass">
    <div class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
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
          class="h-auto w-full rounded bg-node-component-surface p-2 data-[state=on]:bg-muted-background"
        >
          <span class="text-center text-sm font-bold text-base-foreground">
            {{ option.label }}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div class="flex min-h-0 flex-1 shrink flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-base-foreground">
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
          class="flex-1 grid grid-cols-1 grid-rows-1 place-content-center-safe"
        >
          <div
            v-if="hasBothComparisonImages"
            ref="comparisonPreviewRef"
            class="relative col-span-full row-span-full cursor-crosshair overflow-hidden rounded-lg"
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

          <div
            :class="
              cn(
                'col-span-full row-span-full flex gap-2',
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
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors',
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

  <div v-else class="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
    <p class="text-sm text-base-foreground">
      {{ $t('comfyHubPublish.createProfileToPublish') }}
    </p>

    <button
      type="button"
      class="flex w-64 items-center gap-4 rounded-2xl border border-dashed border-border-default px-6 py-4 hover:bg-secondary-background-hover"
      @click="emit('requestProfile')"
    >
      <div
        class="flex size-12 items-center justify-center rounded-full border border-dashed border-border-default"
      >
        <i class="icon-[lucide--user] size-4 text-muted-foreground" />
      </div>
      <span class="inline-flex items-center gap-1 text-sm text-base-foreground">
        <i class="icon-[lucide--plus] size-4" />
        {{ $t('comfyHubPublish.createProfileCta') }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSliderFromMouse } from '@/platform/workflow/sharing/composables/useSliderFromMouse'
import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { cn } from '@/utils/tailwindUtil'
import { useDropZone } from '@vueuse/core'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { thumbnailType = 'image', embedded = false } = defineProps<{
  thumbnailType?: ThumbnailType
  embedded?: boolean
}>()

const emit = defineEmits<{
  'update:thumbnailType': [value: ThumbnailType]
  'update:thumbnailFile': [value: File]
  'update:comparisonBeforeFile': [value: File]
  'update:comparisonAfterFile': [value: File]
  requestProfile: []
}>()

const { t } = useI18n()

const containerClass = computed(() =>
  cn('flex min-h-0 flex-1 flex-col gap-6', embedded ? 'px-0 py-0' : 'px-6 py-4')
)

function isThumbnailType(value: string): value is ThumbnailType {
  return value === 'image' || value === 'video' || value === 'imageComparison'
}

function handleThumbnailTypeChange(value: unknown) {
  if (typeof value === 'string' && isThumbnailType(value)) {
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
    label: t('comfyHubPublish.thumbnailImage')
  },
  {
    value: 'video' as const,
    label: t('comfyHubPublish.thumbnailVideo')
  },
  {
    value: 'imageComparison' as const,
    label: t('comfyHubPublish.thumbnailImageComparison')
  }
]

const thumbnailPreviewUrl = ref<string | null>(null)
const isVideoFile = ref(false)

onBeforeUnmount(() => {
  if (thumbnailPreviewUrl.value) {
    URL.revokeObjectURL(thumbnailPreviewUrl.value)
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
const previewSliderPosition = useSliderFromMouse(comparisonPreviewRef)

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
    return
  }

  clearThumbnailPreview()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    setThumbnailPreview(file)
  }
}

const singleDropRef = ref<HTMLElement | null>(null)

function isImageType(types: readonly string[]) {
  return types.some((type) => type.startsWith('image/'))
}

function isMediaType(types: readonly string[]) {
  return types.some(
    (type) => type.startsWith('video/') || type.startsWith('image/')
  )
}

const { isOverDropZone: isOverSingleDrop } = useDropZone(singleDropRef, {
  dataTypes: (types: readonly string[]) =>
    thumbnailType === 'video' ? isMediaType(types) : isImageType(types),
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

const comparisonPreviewUrls = reactive<Record<ComparisonSlot, string | null>>({
  before: null,
  after: null
})

onBeforeUnmount(() => {
  for (const url of Object.values(comparisonPreviewUrls)) {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }
})

function setComparisonPreview(file: File, slot: ComparisonSlot) {
  if (comparisonPreviewUrls[slot]) {
    URL.revokeObjectURL(comparisonPreviewUrls[slot]!)
  }

  comparisonPreviewUrls[slot] = URL.createObjectURL(file)
  if (slot === 'before') {
    emit('update:comparisonBeforeFile', file)
    return
  }

  emit('update:comparisonAfterFile', file)
}

function handleComparisonSelect(event: Event, slot: ComparisonSlot) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    setComparisonPreview(file, slot)
  }
}

const comparisonDropRefs = reactive<Record<ComparisonSlot, HTMLElement | null>>(
  { before: null, after: null }
)
const { isOverDropZone: isOverBefore } = useDropZone(
  computed(() => comparisonDropRefs.before),
  {
    dataTypes: isImageType,
    multiple: false,
    onDrop(files) {
      const file = files?.[0]
      if (file) {
        setComparisonPreview(file, 'before')
      }
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
      if (file) {
        setComparisonPreview(file, 'after')
      }
    }
  }
)

const comparisonOverStates = computed(() => ({
  before: isOverBefore.value,
  after: isOverAfter.value
}))
</script>
