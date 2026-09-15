<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ImageLightbox from '@/components/common/ImageLightbox.vue'
import { useClickDragGuard } from '@/composables/useClickDragGuard'
import AudioPreviewPlayer from '@/renderer/extensions/vueNodes/widgets/components/audio/AudioPreviewPlayer.vue'
import { cn } from '@comfyorg/tailwind-utils'

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
    mediaUrl?: string
    mediaType?: 'image' | 'video' | 'audio'
    label?: string
    onClick?: (e: MouseEvent) => void
    onMaskEdit?: () => void
  }
  forceHovered?: boolean
}>()

const mediaType = computed(() => dropIndicator?.mediaType ?? 'image')
// Video's native controls and AudioPreviewPlayer's buttons are invalid
// markup nested inside a <button> — render a <div> instead once one is shown.
const hasPlayableMedia = computed(
  () => mediaType.value !== 'image' && !!dropIndicator?.mediaUrl
)

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)
const clickGuard = useClickDragGuard(5)
const lightboxOpen = ref(false)

function onPointerDown(e: PointerEvent) {
  clickGuard.recordStart(e)
}

function onIndicatorClick(e: MouseEvent) {
  const dragged = e.detail !== 0 && clickGuard.wasDragged(e)
  clickGuard.reset()
  if (dragged) return
  dropIndicator?.onClick?.(e)
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (_files, event) => {
    // Stop propagation to prevent global handlers from creating a new node
    event.stopPropagation()

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
const indicatorTag = computed(() =>
  dropIndicator?.onClick && !hasPlayableMedia.value ? 'button' : 'div'
)
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
        :type="indicatorTag === 'button' ? 'button' : undefined"
        :aria-label="
          indicatorTag === 'button' ? dropIndicator.label : undefined
        "
        data-slot="drop-zone-indicator"
        data-testid="drop-zone-indicator"
        :class="
          cn(
            'm-3 block h-25 w-[calc(100%-1.5rem)] resize-y appearance-none overflow-hidden rounded-lg border border-node-component-border bg-transparent p-1 text-left text-component-node-foreground-secondary transition-colors',
            indicatorTag === 'button' && 'cursor-pointer'
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
                !dropIndicator.mediaUrl &&
                'border border-dashed border-component-node-foreground-secondary bg-component-node-widget-background-hovered'
            )
          "
        >
          <div v-if="dropIndicator.mediaUrl" class="max-h-full max-w-full">
            <img
              v-if="mediaType === 'image'"
              class="max-h-full max-w-full rounded-md object-contain"
              data-testid="drop-zone-media"
              :alt="dropIndicator.label ?? ''"
              :src="dropIndicator.mediaUrl"
            />
            <video
              v-else-if="mediaType === 'video'"
              class="max-h-full max-w-full rounded-md object-contain"
              data-testid="drop-zone-media"
              :aria-label="dropIndicator.label ?? ''"
              :src="dropIndicator.mediaUrl"
              controls
              playsinline
              preload="metadata"
              @click.stop
            />
            <AudioPreviewPlayer
              v-else
              data-testid="drop-zone-media"
              :model-value="dropIndicator.mediaUrl"
              :hide-when-empty="false"
              @click.stop
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
      <template v-if="mediaType === 'image' && dropIndicator.mediaUrl">
        <div
          class="absolute top-2 right-5 z-10 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within/dropzone:opacity-100 group-hover/dropzone:opacity-100"
        >
          <button
            v-if="dropIndicator.onMaskEdit"
            type="button"
            :aria-label="t('maskEditor.openMaskEditor')"
            :title="t('maskEditor.openMaskEditor')"
            class="flex cursor-pointer items-center justify-center rounded-lg bg-base-foreground p-2 text-base-background transition-colors hover:bg-base-foreground/90"
            @click.stop="dropIndicator.onMaskEdit()"
          >
            <i class="icon-[comfy--mask] size-4" />
          </button>
          <button
            type="button"
            :aria-label="t('mediaAsset.actions.zoom')"
            :title="t('mediaAsset.actions.zoom')"
            class="flex cursor-pointer items-center justify-center rounded-lg bg-base-foreground p-2 text-base-background transition-colors hover:bg-base-foreground/90"
            @click.stop="lightboxOpen = true"
          >
            <i class="icon-[lucide--zoom-in] size-4" />
          </button>
        </div>
        <ImageLightbox
          v-model="lightboxOpen"
          :src="dropIndicator.mediaUrl"
          :alt="dropIndicator.label ?? ''"
        />
      </template>
    </div>
  </div>
  <slot v-else />
</template>
