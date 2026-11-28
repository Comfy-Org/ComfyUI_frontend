<template>
  <Teleport v-if="galleryVisible" to="body">
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('g.gallery')"
      tabindex="-1"
      class="fixed inset-0 z-overlay flex items-center justify-center bg-black/90 outline-none"
      data-mask
      @mousedown="onMaskMouseDown"
      @mouseup="onMaskMouseUp"
      @keydown.stop="handleKeyDown"
    >
      <Button
        variant="secondary"
        size="icon-lg"
        class="absolute top-4 right-4 z-10 rounded-full"
        :aria-label="$t('g.close')"
        @click="close"
      >
        <i class="icon-[lucide--x] size-5" />
      </Button>

      <Button
        v-if="hasMultiple"
        variant="secondary"
        size="icon-lg"
        class="fixed top-1/2 left-4 z-10 -translate-y-1/2 rounded-full"
        :aria-label="$t('g.previous')"
        @click="navigateImage(-1)"
      >
        <i class="icon-[lucide--chevron-left] size-6" />
      </Button>

      <div class="flex max-h-full max-w-full items-center justify-center">
        <template v-if="activeItem">
          <KeepAlive :max="RETAINED_VIDEO_COUNT" include="ResultVideo">
            <div
              v-if="isImageResult(activeItem)"
              ref="zoomTargetRef"
              :key="resultItemUrl(activeItem)"
              data-testid="lightbox-zoom-target"
              :style="transformStyle"
              :class="
                cn(
                  'touch-none',
                  isZoomed && 'cursor-grab',
                  isPanning && 'cursor-grabbing'
                )
              "
              @wheel.prevent="handleWheel"
              @dblclick="handleDoubleClick"
              @pointerdown="handlePointerDown"
              @pointermove="handlePointerMove"
              @pointerup="handlePointerUp"
              @pointercancel="handlePointerUp"
              @lostpointercapture="handlePointerUp"
              @dragstart.prevent
              @load.capture="recordNaturalWidth"
            >
              <ComfyImage
                :src="resultItemUrl(activeItem)"
                :contain="false"
                :alt="activeItem.filename"
                class="size-auto max-h-[90vh] max-w-[90vw] object-contain"
              />
            </div>
            <ResultVideo
              v-else-if="isVideoResult(activeItem)"
              :key="resultItemUrl(activeItem)"
              :result="activeItem"
              :autoplay="autoplayVideo"
            />
            <ResultAudio
              v-else-if="isAudioResult(activeItem)"
              :result="activeItem"
            />
            <ResultText
              v-else-if="isTextResult(activeItem)"
              :result="activeItem"
            />
          </KeepAlive>
        </template>
      </div>

      <Badge
        v-if="isZoomed && zoomPercent"
        variant="chip"
        data-testid="lightbox-zoom-percentage"
        class="pointer-events-none absolute bottom-4 left-4 z-10"
      >
        {{ $t('g.zoomPercent', { percent: zoomPercent }) }}
      </Badge>

      <Button
        v-if="hasMultiple"
        variant="secondary"
        size="icon-lg"
        class="fixed top-1/2 right-4 z-10 -translate-y-1/2 rounded-full"
        :aria-label="$t('g.next')"
        @click="navigateImage(1)"
      >
        <i class="icon-[lucide--chevron-right] size-6" />
      </Button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'
import {
  isAudioResult,
  isImageResult,
  isTextResult,
  isVideoResult
} from '@/utils/resultItem'

import ResultAudio from './ResultAudio.vue'
import ResultText from './ResultText.vue'
import ResultVideo from './ResultVideo.vue'
import { useImagePanZoom } from './useImagePanZoom'

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const props = defineProps<{
  allGalleryItems: AugmentedResultItem[]
  activeIndex: number
  autoplayVideo?: boolean
}>()

/* Keeps the active video plus its neighbors buffered across gallery moves. */
const RETAINED_VIDEO_COUNT = 3

const galleryVisible = ref(false)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null
const hasMultiple = computed(() => props.allGalleryItems.length > 1)
const activeItem = computed(() => props.allGalleryItems[props.activeIndex])

const zoomTargetRef = ref<HTMLElement>()
const naturalWidth = ref(0)
const {
  scale,
  isZoomed,
  isPanning,
  transformStyle,
  reset: resetZoom,
  handleWheel,
  handleDoubleClick,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp
} = useImagePanZoom(zoomTargetRef)

const zoomPercent = computed(() => {
  const fittedWidth = zoomTargetRef.value?.offsetWidth ?? 0
  if (!naturalWidth.value || !fittedWidth) return null
  return Math.round(((fittedWidth * scale.value) / naturalWidth.value) * 100)
})

function recordNaturalWidth(event: Event) {
  if (event.target instanceof HTMLImageElement) {
    naturalWidth.value = event.target.naturalWidth
  }
}

watch(
  () => activeItem.value && resultItemUrl(activeItem.value),
  () => {
    resetZoom()
    naturalWidth.value = 0
  }
)

watch(
  () => props.activeIndex,
  (index) => {
    galleryVisible.value = index !== -1
    if (index !== -1) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      void nextTick(() => dialogRef.value?.focus())
    }
  },
  { immediate: true }
)

const neighborImageUrls = computed(() => {
  if (!galleryVisible.value || !hasMultiple.value) return []
  const count = props.allGalleryItems.length
  return [-1, 1]
    .map(
      (step) =>
        props.allGalleryItems[(props.activeIndex + step + count) % count]
    )
    .filter(isImageResult)
    .map(resultItemUrl)
})

watch(
  neighborImageUrls,
  (urls) => {
    for (const url of urls) {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
    }
  },
  { immediate: true }
)

function close() {
  galleryVisible.value = false
  emit('update:activeIndex', -1)
  previouslyFocusedElement?.focus()
  previouslyFocusedElement = null
}

function navigateImage(direction: number) {
  const newIndex =
    (props.activeIndex + direction + props.allGalleryItems.length) %
    props.allGalleryItems.length
  emit('update:activeIndex', newIndex)
}

let maskMouseDownTarget: EventTarget | null = null

function onMaskMouseDown(event: MouseEvent) {
  maskMouseDownTarget = event.target
}

function onMaskMouseUp(event: MouseEvent) {
  if (
    maskMouseDownTarget === event.target &&
    (event.target as HTMLElement)?.hasAttribute('data-mask')
  ) {
    close()
  }
}

function handleKeyDown(event: KeyboardEvent) {
  const actions: Record<string, () => void> = {
    ArrowLeft: () => navigateImage(-1),
    ArrowRight: () => navigateImage(1),
    Escape: () => close()
  }

  const action = actions[event.key]
  if (action) {
    event.preventDefault()
    action()
  }
}
</script>
