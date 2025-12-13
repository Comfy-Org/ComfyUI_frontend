<template>
  <div
    class="w-full col-span-2 widget-expands grid grid-cols-[minmax(80px,max-content)_minmax(125px,auto)] gap-y-3 p-3"
  >
    <WidgetSelect v-model="modelValue" :widget class="col-span-2" />
    <AudioPreviewPlayer
      class="col-span-2"
      :audio-url="audioUrlFromWidget"
      :readonly="readonly"
      :hide-when-empty="isOutputNodeRef"
      :show-options-button="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { isOutputNode } from '@/utils/nodeFilterUtil'

import { getAudioUrlFromPath } from '../utils/audioUtils'
import WidgetSelect from './WidgetSelect.vue'
import AudioPreviewPlayer from './audio/AudioPreviewPlayer.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | undefined>
  readonly?: boolean
  nodeId: string
}>()

const modelValue = defineModel<string>('modelValue')

defineEmits<{
  'update:modelValue': [value: string]
}>()

// Get litegraph node
const litegraphNode = computed(() => {
  if (!props.nodeId || !app.canvas.graph) return null
  return app.canvas.graph.getNodeById(props.nodeId) as LGraphNode | null
})

// Check if this is an output node (PreviewAudio, SaveAudio, etc)
const isOutputNodeRef = computed(() => {
  const node = litegraphNode.value
  if (!node) return false
  return isOutputNode(node)
})

const audioFilePath = computed(() => props.widget.value as string)

// Computed audio URL from widget value (for input files)
const audioUrlFromWidget = computed(() => {
  const path = audioFilePath.value
  if (!path) return ''
  return getAudioUrlFromPath(path, 'input')
})
</script>
