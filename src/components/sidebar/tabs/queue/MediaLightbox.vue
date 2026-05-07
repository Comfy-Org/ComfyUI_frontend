<template>
  <Teleport to="body">
    <div
      v-if="galleryVisible"
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('g.gallery')"
      tabindex="-1"
      class="fixed inset-0 z-9999 flex flex-col outline-none"
      @keydown.stop="handleKeyDown"
    >
      <!-- Dark backdrop (click to close) -->
      <div
        class="absolute inset-0 bg-black/90"
        data-mask
        @mousedown="onMaskMouseDown"
        @mouseup="onMaskMouseUp"
      />

      <!-- Top bar: toggle + close buttons -->
      <div class="relative z-10 flex justify-end gap-2 p-4">
        <Button
          v-if="asset"
          variant="secondary"
          size="icon-lg"
          class="rounded-full"
          :aria-label="$t('g.showRightPanel')"
          @click="infoPanelOpen = !infoPanelOpen"
        >
          <i class="icon-[lucide--panel-right] size-5" />
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

      <!-- Main content area -->
      <div
        class="relative z-10 grid min-h-0 flex-1 gap-4 px-4 pb-4 transition-[grid-template-columns] duration-300 ease-out"
        :style="{
          gridTemplateColumns: `1fr ${showPanel ? '20rem' : '0rem'}`
        }"
      >
        <!-- Media content (nav arrows are absolute within this) -->
        <div class="relative flex items-center justify-center">
          <!-- Previous Button -->
          <Button
            v-if="hasMultiple"
            variant="secondary"
            size="icon-lg"
            class="absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-full"
            :aria-label="$t('g.previous')"
            @click="navigateImage(-1)"
          >
            <i class="icon-[lucide--chevron-left] size-6" />
          </Button>

          <template v-if="activeItem">
            <ComfyImage
              v-if="activeItem.isImage"
              :key="activeItem.url"
              :src="activeItem.url"
              :contain="false"
              :alt="activeItem.filename"
              class="size-auto max-h-[85vh] max-w-full object-contain transition-[max-width] duration-300 ease-out"
            />
            <ResultVideo v-else-if="activeItem.isVideo" :result="activeItem" />
            <ResultAudio v-else-if="activeItem.isAudio" :result="activeItem" />
          </template>

          <!-- Next Button -->
          <Button
            v-if="hasMultiple"
            variant="secondary"
            size="icon-lg"
            class="absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-full"
            :aria-label="$t('g.next')"
            @click="navigateImage(1)"
          >
            <i class="icon-[lucide--chevron-right] size-6" />
          </Button>
        </div>

        <!-- Info panel: outer div clips via grid column, inner div is fixed width -->
        <div class="min-w-0 overflow-hidden">
          <div
            v-if="asset"
            class="h-full w-80 overflow-y-auto rounded-lg border border-border-subtle bg-base-background shadow-sm"
          >
            <MediaAssetInfoPanel
              :asset="asset!"
              :tag-suggestions="tagSuggestions"
              :property-suggestions="propertySuggestions"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import Button from '@/components/ui/button/Button.vue'
import MediaAssetInfoPanel from '@/platform/assets/components/mediaInfo/MediaAssetInfoPanel.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { PropertySuggestion } from '@/platform/assets/schemas/userPropertySchema'
import type { ResultItemImpl } from '@/stores/queueStore'

import ResultAudio from './ResultAudio.vue'
import ResultVideo from './ResultVideo.vue'

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const {
  allGalleryItems,
  activeIndex,
  asset,
  tagSuggestions = [],
  propertySuggestions
} = defineProps<{
  allGalleryItems: ResultItemImpl[]
  activeIndex: number
  asset?: AssetItem
  tagSuggestions?: string[]
  propertySuggestions?: Map<string, PropertySuggestion>
}>()

const galleryVisible = ref(false)
const infoPanelOpen = useStorage('Comfy.Lightbox.InfoPanelOpen', true)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null
const hasMultiple = computed(() => allGalleryItems.length > 1)
const activeItem = computed(() => allGalleryItems[activeIndex])
const showPanel = computed(() => infoPanelOpen.value && !!asset)

watch(
  () => activeIndex,
  (index) => {
    galleryVisible.value = index !== -1
    if (index !== -1) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      void nextTick(() => dialogRef.value?.focus())
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
    (activeIndex + direction + allGalleryItems.length) % allGalleryItems.length
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
