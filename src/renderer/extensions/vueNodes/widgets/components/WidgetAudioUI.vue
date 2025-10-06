<template>
  <div class="w-full">
    <WidgetSelect v-model="modelValue" :widget="props.widget" />
    <p class="my-4"></p>
    <AudioPreviewPlayer
      :audio-url="audioUrlFromWidget"
      :readonly="readonly"
      :hide-when-empty="isOutputNode"
      :show-options-button="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { getAudioUrlFromPath } from '../utils/audioUtils'
import WidgetSelect from './WidgetSelect.vue'
import AudioPreviewPlayer from './audio/AudioPreviewPlayer.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()

const modelValue = defineModel<string>('modelValue')

defineEmits<{
  'update:modelValue': [value: string]
}>()

// Get litegraph node
const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

// Check if this is an output node (PreviewAudio, SaveAudio, etc)
const isOutputNode = computed(() => {
  const node = litegraphNode.value
  if (!node) return false

  const fromNode = node.constructor.nodeData?.output_node === true

  const nodeClass = node.constructor?.comfyClass || node.type || 'Unknown'

  const isPreviewOrSaveNode = [
    'PreviewAudio',
    'SaveAudio',
    'SaveAudioMP3',
    'SaveAudioOpus'
  ].includes(nodeClass)

  return fromNode || isPreviewOrSaveNode
})

const audioFilePath = computed(() => props.widget.value as string)

// Computed audio URL from widget value (for input files)
const audioUrlFromWidget = computed(() => {
  const path = audioFilePath.value
  if (!path) return ''
  return getAudioUrlFromPath(path, 'input')
})
</script>
