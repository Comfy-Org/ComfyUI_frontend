<template>
  <div
    :class="cn(!videoUrl && 'flex h-full min-h-0 min-w-0 flex-1 flex-col')"
    :data-widget-name="widget.name"
  >
    <LoadVideoTrimPanel
      v-model:trim-enabled="trimEnabled"
      v-model:start-frame="startFrame"
      v-model:end-frame="endFrame"
      v-model:playhead-frame="playheadFrame"
      :video-url="videoUrl"
      :uploading="isProcessing"
      :on-drag-over="handleDragOver"
      :on-drag-drop="handleDragDrop"
      @browse="handleBrowse"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import LoadVideoTrimPanel from '@/components/video/LoadVideoTrimPanel.vue'
import { useLoadVideoPreview } from '@/composables/video/useLoadVideoPreview'
import type { VideoTrimValue } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { cn } from '@comfyorg/tailwind-utils'
import { app } from '@/scripts/app'

const { nodeId } = defineProps<{
  widget: SimplifiedWidget<VideoTrimValue>
  nodeId: NodeId
}>()

const modelValue = defineModel<VideoTrimValue>({
  default: () => ({
    trimEnabled: false,
    startFrame: 0,
    endFrame: 0
  })
})

const playheadFrame = ref(0)

const node = computed(() => app.canvas.graph?.getNodeById(nodeId))

const { videoUrl } = useLoadVideoPreview(node)

const isUploading = computed(() => node.value?.isUploading ?? false)

const hasSelectedFile = computed(() => {
  const fileWidget = node.value?.widgets?.find(
    (widget) => widget.name === 'file'
  )
  const value = fileWidget?.value
  if (typeof value === 'string') return value.length > 0
  return Boolean(value)
})

const isProcessing = computed(
  () => isUploading.value || (!videoUrl.value && hasSelectedFile.value)
)

const trimEnabled = computed({
  get: () => modelValue.value.trimEnabled,
  set: (trimEnabled) => {
    modelValue.value = { ...modelValue.value, trimEnabled }
  }
})

const startFrame = computed({
  get: () => modelValue.value.startFrame,
  set: (startFrame) => {
    modelValue.value = { ...modelValue.value, startFrame }
  }
})

const endFrame = computed({
  get: () => modelValue.value.endFrame,
  set: (endFrame) => {
    modelValue.value = { ...modelValue.value, endFrame }
  }
})

function handleBrowse() {
  node.value?.widgets
    ?.find((widget) => widget.name === 'upload')
    ?.callback?.(undefined)
}

function handleDragOver(event: DragEvent) {
  return node.value?.onDragOver?.(event) ?? false
}

function handleDragDrop(event: DragEvent) {
  event.stopPropagation()
  return node.value?.onDragDrop?.(event) ?? false
}

watch(videoUrl, (url, previousUrl) => {
  playheadFrame.value = 0
  if (url && url !== previousUrl) {
    modelValue.value = {
      ...modelValue.value,
      trimEnabled: false,
      startFrame: 0,
      endFrame: 0
    }
  }
})
</script>
