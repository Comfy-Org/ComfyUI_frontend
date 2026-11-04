<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import type {
  FileModality,
  NodeId
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { acceptFor } from '@/renderer/extensions/superComfy/media/superMedia'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'
import { modalityIcon } from '@/renderer/extensions/superComfy/superComfyModality'

const { nodeId, modality, empty } = defineProps<{
  nodeId: NodeId
  modality: FileModality
  empty: boolean
}>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()

const dialog = useFileDialog({
  multiple: true,
  accept: acceptFor(modality),
  reset: true
})

dialog.onChange((files) => {
  if (files) void store.uploadFiles(nodeId, Array.from(files))
})

const indicator = computed(() =>
  empty
    ? {
        iconClass: modalityIcon(modality),
        label: t('superComfy.node.dropFiles'),
        onClick: () => dialog.open()
      }
    : undefined
)

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function onDrop(event: DragEvent): boolean {
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length === 0) return false
  void store.uploadFiles(nodeId, files)
  return true
}
</script>

<template>
  <DropZone
    :on-drag-over="hasFiles"
    :on-drag-drop="onDrop"
    :drop-indicator="indicator"
    class="flex min-h-0 flex-1 flex-col"
  >
    <slot />
  </DropZone>
</template>
