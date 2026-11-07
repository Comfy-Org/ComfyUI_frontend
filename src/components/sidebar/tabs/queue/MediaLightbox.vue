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
      <div class="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          v-if="activeItem"
          variant="secondary"
          size="icon-lg"
          class="rounded-full"
          :title="$t('g.download')"
          :aria-label="$t('g.download')"
          @click="downloadActiveItem"
        >
          <i class="icon-[lucide--download] size-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon-lg"
          class="rounded-full"
          :aria-label="$t('g.close')"
          @click="close"
        >
          <i class="icon-[lucide--x] size-5" />
        </Button>
      </div>

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

      <div
        ref="contentRef"
        class="relative flex max-h-full max-w-full items-center justify-center"
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
              @load="imageSettled.load"
              @error="imageSettled.error"
            />
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

      <div
        v-if="activeItem"
        data-testid="lightbox-caption"
        :class="captionClass"
        @mouseenter="pinCaption"
        @mouseleave="unpinCaption"
        @focusin="pinCaption"
        @focusout="onCaptionFocusOut"
      >
        <span data-testid="lightbox-filename" :title="activeItem.filename">
          {{ activeItem.filename }}
        </span>
      </div>

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
import Button from '@comfyorg/design-system/button/Button'
import {
  createFileDownload,
  useAssetDownload
} from '@/composables/useAssetDownload'
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
import { cn } from '@comfyorg/tailwind-utils'

import { useLightboxCaption } from './useLightboxCaption'

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

const { downloadFiles } = useAssetDownload()

const galleryVisible = ref(false)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null
const hasMultiple = computed(() => props.allGalleryItems.length > 1)
const activeItem = computed(() => props.allGalleryItems[props.activeIndex])

const contentRef = ref<HTMLElement>()

const mediaReady = ref(false)
const mediaSeq = ref(0)

const {
  visible: captionVisible,
  reveal: revealCaption,
  hide: hideCaption,
  pin: pinCaption,
  unpin: unpinCaption
} = useLightboxCaption(() => mediaReady.value)

const captionClass = computed(() =>
  cn(
    'absolute bottom-4 left-4 z-10 max-w-[60vw] truncate bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm transition-opacity',
    captionVisible.value
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0'
  )
)

function onCaptionFocusOut(event: FocusEvent) {
  const { currentTarget, relatedTarget } = event
  if (
    currentTarget instanceof Node &&
    relatedTarget instanceof Node &&
    currentTarget.contains(relatedTarget)
  )
    return
  unpinCaption()
}

const imageSettled = computed(() => {
  const seq = mediaSeq.value
  return {
    load: () => markMediaReady(seq),
    error: () => markMediaReady(seq)
  }
})

function markMediaReady(seq: number) {
  if (seq !== mediaSeq.value) return
  mediaReady.value = true
}

function onContentMouseMove() {
  revealCaption()
}

function onContentTouchStart() {
  revealCaption()
}

function onContentFocusIn() {
  revealCaption()
}

function onContentFocusOut(event: FocusEvent) {
  if (
    event.relatedTarget instanceof Node &&
    contentRef.value?.contains(event.relatedTarget)
  )
    return
  hideCaption()
}

let lastActiveUrl: string | undefined

watch(
  () => props.activeIndex,
  (index) => {
    if (index === -1) {
      galleryVisible.value = false
      lastActiveUrl = undefined
      hideCaption()
      return
    }
    const item = activeItem.value
    const url = item && resultItemUrl(item)
    const wasVisible = galleryVisible.value
    if (wasVisible && url !== undefined && url === lastActiveUrl) {
      return
    }
    galleryVisible.value = true
    lastActiveUrl = url
    if (!wasVisible) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
    }
    mediaSeq.value += 1
    const seq = mediaSeq.value
    mediaReady.value = false
    hideCaption()
    void nextTick(() => {
      if (seq !== mediaSeq.value) return
      const nextItem = activeItem.value
      if (nextItem && !isImageResult(nextItem)) markMediaReady(seq)
      revealCaption()
      dialogRef.value?.focus()
    })
  },
  { immediate: true }
)

function close() {
  mediaSeq.value += 1
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
