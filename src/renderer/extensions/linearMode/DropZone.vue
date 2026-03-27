<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ImageLightbox from '@/components/common/ImageLightbox.vue'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ inheritAttrs: false })

const { t } = useI18n()

const {
  onDragOver,
  onDragDrop,
  dropIndicator,
  forceHovered = false
} = defineProps<{
  onDragOver?: (e: DragEvent) => boolean
  onDragDrop?: (e: DragEvent) => Promise<boolean> | boolean
  dropIndicator?: {
    iconClass?: string
    imageUrl?: string
    videoUrl?: string
    label?: string
    onClick?: (e: MouseEvent) => void
    onMaskEdit?: () => void
    onDownload?: () => void
    onRemove?: () => void
  }
  forceHovered?: boolean
}>()

const actionButtonClass =
  'flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-neutral-800 text-white shadow-md transition-colors hover:bg-neutral-700'

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)
const pointerStart = ref<{ x: number; y: number } | null>(null)
const lightboxOpen = ref(false)

function onPointerDown(e: PointerEvent) {
  pointerStart.value = { x: e.clientX, y: e.clientY }
}

function onIndicatorClick(e: MouseEvent) {
  if (e.detail !== 0) {
    const start = pointerStart.value
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy > 25) {
        pointerStart.value = null
        return
      }
    }
  }
  pointerStart.value = null
  dropIndicator?.onClick?.(e)
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (_files, event) => {
    // Stop propagation to prevent global handlers from creating a new node
    event?.stopPropagation()

    if (onDragDrop && event) {
      onDragDrop(event)
    }
    canAcceptDrop.value = false
  },
  onOver: (_, event) => {
    if (onDragOver && event) {
      canAcceptDrop.value = onDragOver(event)
    }
  },
  onLeave: () => {
    canAcceptDrop.value = false
  }
})

const isHovered = computed(
  () => forceHovered || (canAcceptDrop.value && isOverDropZone.value)
)
const indicatorTag = computed(() => (dropIndicator?.onClick ? 'button' : 'div'))
</script>
<template>
  <div
    v-if="onDragOver && onDragDrop"
    ref="dropZoneRef"
    v-bind="$attrs"
    data-slot="drop-zone"
    :class="
      cn(
        'rounded-lg transition-colors',
        isHovered && 'bg-component-node-widget-background-hovered'
      )
    "
  >
    <slot />
    <div v-if="dropIndicator" class="group/dropzone relative">
      <component
        :is="indicatorTag"
        :type="dropIndicator.onClick ? 'button' : undefined"
        :aria-label="dropIndicator.onClick ? dropIndicator.label : undefined"
        data-slot="drop-zone-indicator"
        :class="
          cn(
            'm-3 block w-[calc(100%-1.5rem)] resize-y appearance-none overflow-hidden rounded-lg border border-node-component-border bg-transparent p-1 text-left text-component-node-foreground-secondary transition-colors',
            dropIndicator.imageUrl || dropIndicator.videoUrl ? 'h-52' : 'h-25',
            dropIndicator.onClick && 'cursor-pointer'
          )
        "
        @pointerdown="onPointerDown"
        @click.prevent="onIndicatorClick"
      >
        <div
          :class="
            cn(
              'flex h-full max-w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[7px] p-3 text-center text-sm/tight transition-colors',
              isHovered &&
                !(dropIndicator.imageUrl || dropIndicator.videoUrl) &&
                'border border-dashed border-component-node-foreground-secondary bg-component-node-widget-background-hovered'
            )
          "
        >
          <div
            v-if="dropIndicator.imageUrl"
            class="flex size-full items-center justify-center overflow-hidden"
          >
            <img
              class="max-h-full max-w-full rounded-md object-contain"
              :alt="dropIndicator.label ?? ''"
              :src="dropIndicator.imageUrl"
            />
          </div>
          <div
            v-else-if="dropIndicator.videoUrl"
            class="flex size-full items-center justify-center overflow-hidden"
            @click.stop
          >
            <video
              class="max-h-full max-w-full rounded-md object-contain"
              :src="dropIndicator.videoUrl"
              preload="metadata"
              controls
              loop
              playsinline
            />
          </div>
          <template v-else>
            <span v-if="dropIndicator.label" v-text="dropIndicator.label" />
            <i
              v-if="dropIndicator.iconClass"
              :class="
                cn(
                  'size-4 text-component-node-foreground-secondary',
                  dropIndicator.iconClass
                )
              "
            />
          </template>
        </div>
      </component>
      <template v-if="dropIndicator.imageUrl || dropIndicator.videoUrl">
        <div
          v-if="dropIndicator.imageUrl"
          class="absolute top-2 right-5 z-10 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within/dropzone:opacity-100 group-hover/dropzone:opacity-100"
        >
          <button
            type="button"
            :class="actionButtonClass"
            :aria-label="t('mediaAsset.actions.zoom')"
            :title="t('mediaAsset.actions.zoom')"
            @click.stop="lightboxOpen = true"
          >
            <i class="icon-[lucide--fullscreen] size-4" />
          </button>
          <button
            v-if="dropIndicator.onMaskEdit"
            type="button"
            :class="actionButtonClass"
            :aria-label="t('maskEditor.editMask')"
            :title="t('maskEditor.editMask')"
            @click.stop="dropIndicator.onMaskEdit()"
          >
            <i class="icon-[comfy--mask] size-4" />
          </button>
          <button
            v-if="dropIndicator.onDownload"
            type="button"
            :class="actionButtonClass"
            :aria-label="t('g.downloadImage')"
            :title="t('g.downloadImage')"
            @click.stop="dropIndicator.onDownload()"
          >
            <i class="icon-[lucide--download] size-4" />
          </button>
          <button
            v-if="dropIndicator.onRemove"
            type="button"
            :class="actionButtonClass"
            :aria-label="t('g.removeImage')"
            :title="t('g.removeImage')"
            @click.stop="dropIndicator.onRemove()"
          >
            <i class="icon-[lucide--x] size-4" />
          </button>
        </div>
        <ImageLightbox
          v-if="dropIndicator.imageUrl"
          v-model="lightboxOpen"
          :src="dropIndicator.imageUrl"
          :alt="dropIndicator.label ?? ''"
        />
      </template>
    </div>
  </div>
  <slot v-else />
</template>
