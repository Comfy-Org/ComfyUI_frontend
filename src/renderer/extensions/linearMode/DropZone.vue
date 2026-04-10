<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ImageLightbox from '@/components/common/ImageLightbox.vue'
import { useClickDragGuard } from '@/composables/useClickDragGuard'
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
    label?: string
    onClick?: (e: MouseEvent) => void
    onMaskEdit?: () => void
  }
  forceHovered?: boolean
}>()

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
            'm-3 block h-25 w-[calc(100%-1.5rem)] resize-y appearance-none overflow-hidden rounded-lg border border-node-component-border bg-transparent p-1 text-left text-component-node-foreground-secondary transition-colors',
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
                !dropIndicator.imageUrl &&
                'border border-dashed border-component-node-foreground-secondary bg-component-node-widget-background-hovered'
            )
          "
        >
          <div v-if="dropIndicator.imageUrl" class="max-h-full max-w-full">
            <img
              class="max-h-full max-w-full rounded-md object-contain"
              :alt="dropIndicator.label ?? ''"
              :src="dropIndicator.imageUrl"
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
      <template v-if="dropIndicator.imageUrl">
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
          :src="dropIndicator.imageUrl"
          :alt="dropIndicator.label ?? ''"
        />
      </template>
    </div>
  </div>
  <slot v-else />
</template>
