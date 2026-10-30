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
      <!-- Top-right actions -->
      <div class="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          v-if="hasContextMenu"
          variant="secondary"
          size="icon-lg"
          class="rounded-full"
          :title="$t('g.moreOptions')"
          :aria-label="$t('g.moreOptions')"
          @click="emit('context-menu', $event)"
        >
          <i class="icon-[lucide--ellipsis] size-5" />
        </Button>
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

      <!-- Filename caption -->
      <div
        v-if="activeItem"
        data-testid="lightbox-caption"
        :class="
          cn(
            'absolute bottom-4 left-4 z-10 max-w-[60vw] truncate bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm transition-opacity',
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
        <span data-testid="lightbox-filename" :title="activeItem.filename">
          {{ activeItem.filename }}
        </span>
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
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  ref,
  watch
} from 'vue'

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
  (e: 'context-menu', event: MouseEvent): void
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

const hasContextMenu = computed(
  () =>
    !!getCurrentInstance()?.vnode.props?.['onContextMenu'] &&
    activeItem.value !== undefined
)

const contentRef = ref<HTMLElement>()

const captionVisible = ref(false)
const captionPinned = ref(false)
const mediaReady = ref(false)
let revealQueued = false
let mediaSeq = 0
let captionHideTimer: ReturnType<typeof setTimeout> | undefined

/* Reveals the caption while the pointer moves over the image or has focus, then auto-hides after 2s. While the new media is still loading the reveal is queued instead, so fast skips never flash the caption over an empty frame. */
function showCaptionTransient() {
  if (!mediaReady.value) {
    revealQueued = true
    return
  }
  captionPinned.value = false
  captionVisible.value = true
  clearTimeout(captionHideTimer)
  captionHideTimer = setTimeout(() => {
    captionVisible.value = false
  }, 2000)
}

function markMediaReady(seq: number) {
  if (seq !== mediaSeq) return
  mediaReady.value = true
  if (revealQueued) {
    revealQueued = false
    showCaptionTransient()
  }
}

/* Resolves once the newly mounted image has painted (or failed, whose fallback still names the file). Non-image media is ready immediately. */
function awaitMediaReady(item: AugmentedResultItem, seq: number) {
  if (!isImageResult(item)) {
    markMediaReady(seq)
    return
  }
  const img = contentRef.value?.querySelector('img')
  if (!img) {
    markMediaReady(seq)
    return
  }
  if (img.complete && img.naturalWidth > 0) {
    markMediaReady(seq)
    return
  }
  img.addEventListener('load', () => markMediaReady(seq), { once: true })
  img.addEventListener('error', () => markMediaReady(seq), { once: true })
}

function hideCaptionNow() {
  clearTimeout(captionHideTimer)
  captionVisible.value = false
  captionPinned.value = false
}

function onContentMouseMove(event: MouseEvent) {
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('[data-testid="lightbox-caption"]')
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
      mediaSeq += 1
      const seq = mediaSeq
      mediaReady.value = false
      revealQueued = false
      hideCaptionNow()
      void nextTick(() => {
        if (seq !== mediaSeq) return
        const item = activeItem.value
        if (item) awaitMediaReady(item, seq)
        showCaptionTransient()
        dialogRef.value?.focus()
      })
    } else {
      hideCaptionNow()
    }
  },
  { immediate: true }
)

function close() {
  mediaSeq += 1
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
