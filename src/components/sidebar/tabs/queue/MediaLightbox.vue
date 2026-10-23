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
      <!-- Close Button -->
      <Button
        variant="secondary"
        size="icon-lg"
        class="absolute top-4 right-4 z-10 rounded-full"
        :aria-label="$t('g.close')"
        @click="close"
      >
        <i class="icon-[lucide--x] size-5" />
      </Button>

      <!-- Previous Button -->
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

      <!-- Content -->
      <div
        ref="contentRef"
        class="relative flex max-h-full max-w-full flex-col items-center justify-center"
        data-testid="lightbox-content"
        @mousemove="onContentMouseMove"
        @touchstart="onContentTouchStart"
        @focusin="onContentFocusIn"
        @focusout="onContentFocusOut"
      >
        <template v-if="activeItem">
          <KeepAlive :max="RETAINED_VIDEO_COUNT" include="ResultVideo">
            <ComfyImage
              v-if="isImageResult(activeItem)"
              :key="resultItemUrl(activeItem)"
              :src="resultItemUrl(activeItem)"
              :contain="false"
              :alt="activeItem.filename"
              class="size-auto max-h-[90vh] max-w-[90vw] object-contain"
            />
            <ResultVideo
              v-else-if="isVideoResult(activeItem)"
              :key="resultItemUrl(activeItem)"
              :result="activeItem"
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

        <div
          v-if="activeItem"
          data-testid="lightbox-pill"
          :class="
            cn(
              'mt-2 flex max-w-[90vw] items-center gap-2 rounded-full bg-black/60 py-1 pr-1 pl-4 backdrop-blur-sm transition-opacity',
              captionPinned || captionVisible
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0'
            )
          "
          @mouseenter="onCaptionMouseEnter"
          @mouseleave="onCaptionMouseLeave"
          @focusin="onCaptionFocusIn"
          @focusout="onCaptionFocusOut"
        >
          <span
            class="min-w-0 truncate text-xs text-white/90"
            data-testid="lightbox-filename"
            :title="activeItem.filename"
          >
            {{ activeItem.filename }}
          </span>
          <Button
            variant="secondary"
            size="icon"
            class="shrink-0 rounded-full"
            :title="$t('g.download')"
            :aria-label="$t('g.download')"
            @click="downloadActiveItem"
          >
            <i class="icon-[lucide--download] size-4" />
          </Button>
        </div>
      </div>

      <!-- Next Button -->
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import Button from '@comfyorg/design-system/button/Button'
import {
  createFileDownload,
  useAssetDownload
} from '@/platform/assets/composables/useAssetDownload' 
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'
import {
  isAudioResult,
  isImageResult,
  isTextResult,
  isVideoResult
} from '@/utils/resultItem'
import { cn } from '@comfyorg/tailwind-utils'

import ResultAudio from './ResultAudio.vue'
import ResultText from './ResultText.vue'
import ResultVideo from './ResultVideo.vue'

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const props = defineProps<{
  allGalleryItems: AugmentedResultItem[]
  activeIndex: number
}>()

/* Keeps the active video plus its neighbors buffered across gallery moves. */
const RETAINED_VIDEO_COUNT = 3

const { downloadFiles } = useAssetDownload()

const galleryVisible = ref(false)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null
const hasMultiple = computed(() => props.allGalleryItems.length > 1)
const activeItem = computed(() => props.allGalleryItems[props.activeIndex])

const contentRef = ref<HTMLElement>()

const captionVisible = ref(false)
const captionPinned = ref(false)
let captionHideTimer: ReturnType<typeof setTimeout> | undefined

/* Reveals the caption while the pointer moves over the image or has focus, then auto-hides after 2s. */
function showCaptionTransient() {
  captionPinned.value = false
  captionVisible.value = true
  clearTimeout(captionHideTimer)
  captionHideTimer = setTimeout(() => {
    captionVisible.value = false
  }, 2000)
}

function hideCaptionNow() {
  clearTimeout(captionHideTimer)
  captionVisible.value = false
  captionPinned.value = false
}

function onContentMouseMove(event: MouseEvent) {
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('[data-testid="lightbox-pill"]')
  )
    return
  showCaptionTransient()
}

function onContentTouchStart() {
  showCaptionTransient()
}

function onContentFocusIn() {
  showCaptionTransient()
}

function onContentFocusOut(event: FocusEvent) {
  if (
    event.relatedTarget instanceof Node &&
    contentRef.value?.contains(event.relatedTarget)
  )
    return
  hideCaptionNow()
}

function onCaptionMouseEnter() {
  clearTimeout(captionHideTimer)
  captionPinned.value = true
  captionVisible.value = true
}

function onCaptionMouseLeave() {
  captionPinned.value = false
  captionVisible.value = false
}

function onCaptionFocusIn() {
  clearTimeout(captionHideTimer)
  captionPinned.value = true
  captionVisible.value = true
}

function onCaptionFocusOut(event: FocusEvent) {
  if (
    event.relatedTarget instanceof Node &&
    (event.currentTarget as HTMLElement | null)?.contains(event.relatedTarget)
  )
    return
  captionPinned.value = false
  captionVisible.value = false
}

onBeforeUnmount(() => clearTimeout(captionHideTimer))

watch(
  () => props.activeIndex,
  (index) => {
    galleryVisible.value = index !== -1
    if (index !== -1) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      showCaptionTransient()
      void nextTick(() => dialogRef.value?.focus())
    } else {
      hideCaptionNow()
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

function downloadActiveItem() {
  const item = activeItem.value
  if (!item) return
  void downloadFiles([
    createFileDownload(item.downloadUrl ?? resultItemUrl(item), item.filename)
  ])
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
