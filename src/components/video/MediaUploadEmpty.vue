<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  accept = 'video/*',
  disabled = false,
  uploading = false,
  fill = false,
  onDragOver,
  onDragDrop
} = defineProps<{
  accept?: string
  disabled?: boolean
  uploading?: boolean
  fill?: boolean
  onDragOver?: (event: DragEvent) => boolean
  onDragDrop?: (event: DragEvent) => boolean | Promise<boolean>
}>()

const emit = defineEmits<{
  browse: []
  upload: [files: File[]]
}>()

const { t } = useI18n()

const dropZoneRef = ref<HTMLElement | null>(null)
const canAcceptDrop = ref(false)

const isInteractionDisabled = computed(() => disabled || uploading)

function matchesAccept(file: File) {
  if (!accept || accept === '*/*') return true
  return accept.split(',').some((pattern) => {
    const trimmed = pattern.trim()
    if (trimmed.endsWith('/*')) {
      return file.type.startsWith(trimmed.slice(0, -1))
    }
    return file.type === trimmed
  })
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files, event) => {
    event?.stopPropagation()
    if (isInteractionDisabled.value) return

    if (onDragDrop && event) {
      void onDragDrop(event)
    } else {
      const accepted = Array.from(files ?? []).filter(matchesAccept)
      if (accepted.length) emit('upload', accepted)
    }
    canAcceptDrop.value = false
  },
  onOver: (_, event) => {
    if (isInteractionDisabled.value) {
      canAcceptDrop.value = false
      return
    }
    if (onDragOver && event) {
      canAcceptDrop.value = onDragOver(event)
      return
    }
    const items = event?.dataTransfer?.items
    canAcceptDrop.value = items
      ? Array.from(items).some(
          (item) => item.kind === 'file' && matchesAcceptType(item.type)
        )
      : false
  },
  onLeave: () => {
    canAcceptDrop.value = false
  }
})

function matchesAcceptType(type: string) {
  if (!accept || accept === '*/*') return true
  return accept.split(',').some((pattern) => {
    const trimmed = pattern.trim()
    if (trimmed.endsWith('/*')) {
      return type.startsWith(trimmed.slice(0, -1))
    }
    return type === trimmed
  })
}

const isHovered = computed(
  () =>
    !isInteractionDisabled.value && canAcceptDrop.value && isOverDropZone.value
)

function handleBrowseClick() {
  if (isInteractionDisabled.value) return
  emit('browse')
}
</script>

<template>
  <div
    ref="dropZoneRef"
    data-testid="media-upload-empty"
    :class="
      cn(
        'flex min-h-75 w-full min-w-75 flex-col items-center justify-center gap-0 rounded-lg border border-dashed border-node-component-border bg-node-component-surface px-6 py-8 transition-colors',
        fill && 'size-full flex-1',
        isHovered &&
          'border-component-node-foreground-secondary bg-component-node-widget-background-hovered'
      )
    "
  >
    <template v-if="uploading">
      <Loader size="md" variant="loader-circle" />
      <p class="text-sm text-muted-foreground">
        {{ t('loadVideoTrim.uploading') }}
      </p>
    </template>
    <template v-else>
      <i
        class="icon-[lucide--upload] size-8 text-muted-foreground"
        aria-hidden="true"
      />
      <p
        class="max-w-48 text-center text-sm/snug text-muted-foreground"
      >
        {{ t('loadVideoTrim.dragAndDropVideos') }}
      </p>
      <Button
        variant="inverted"
        size="lg"
        class="min-w-40"
        :disabled="disabled"
        data-testid="media-upload-browse-button"
        @click="handleBrowseClick"
      >
        {{ t('loadVideoTrim.uploadFromDevice') }}
      </Button>
    </template>
  </div>
</template>
