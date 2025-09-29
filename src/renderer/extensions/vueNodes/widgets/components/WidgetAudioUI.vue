<template>
  <div class="w-full">
    <WidgetRecordAudio
      v-if="audioWidgetType === 'record'"
      ref="recordAudioRef"
      :widget="widget"
      :model-value="modelValue"
      :readonly="readonly"
      :node-data="nodeData"
      :node="node"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <AudioPreviewPlayer
      v-else
      ref="audioPreviewRef"
      :readonly="readonly"
      :hide-when-empty="isOutputNode && !hasAudioFromOutputs"
      :show-options-button="true"
      @options-click="handleOptionsClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { getLocatorIdFromNodeData } from '@/utils/graphTraversalUtil'

import { getAudioUrlFromPath, getResourceURL } from '../utils/audioUtils'
import WidgetRecordAudio from './WidgetRecordAudio.vue'
import AudioPreviewPlayer from './audio/AudioPreviewPlayer.vue'

interface AudioOutputMessage {
  audio?: Array<{
    subfolder: string
    filename: string
    type: ResultItemType
  }>
}

const props = defineProps<{
  widget?: any
  readonly?: boolean
  nodeData?: any
  node?: LGraphNode
}>()

const modelValue = defineModel<any>('modelValue')

defineEmits<{
  'update:modelValue': [value: any]
}>()

// Refs
const audioPreviewRef = ref<InstanceType<typeof AudioPreviewPlayer>>()
const recordAudioRef = ref<InstanceType<typeof WidgetRecordAudio>>()

// Check if this is an output node (PreviewAudio, SaveAudio, etc)
const isOutputNode = computed(() => {
  const fromNodeData = props.nodeData?.output_node === true
  const fromNode = props.node?.constructor?.nodeData?.output_node === true

  const nodeClass =
    props.nodeData?.constructor?.comfyClass ||
    props.node?.constructor?.comfyClass ||
    props.nodeData?.type ||
    props.node?.type ||
    'Unknown'

  const isPreviewOrSaveNode = [
    'PreviewAudio',
    'SaveAudio',
    'SaveAudioMP3',
    'SaveAudioOpus'
  ].includes(nodeClass)

  return fromNodeData || fromNode || isPreviewOrSaveNode
})

const audioWidgetType = computed(() => {
  const nodeClass =
    props.nodeData?.constructor?.comfyClass ||
    props.node?.constructor?.comfyClass ||
    props.nodeData?.type ||
    props.node?.type ||
    ''

  // RecordAudio => recorder
  if (nodeClass === 'RecordAudio') {
    return 'record'
  }

  // All other nodes use preview player
  // LoadAudio, SaveAudio, PreviewAudio, SaveAudioMP3, SaveAudioOpus => player
  return 'preview'
})

// Get node locator ID for output tracking
const nodeLocatorId = computed(() => {
  if (!props.nodeData) return null
  return getLocatorIdFromNodeData(props.nodeData as any)
})

// Watch node outputs store for audio updates (for Vue nodes)
const nodeOutputStore = useNodeOutputStore()

// Check if we have audio from node outputs
const hasAudioFromOutputs = computed(() => {
  if (!nodeLocatorId.value) return false
  const nodeOutput = nodeOutputStore.nodeOutputs[nodeLocatorId.value]
  return !!nodeOutput?.audio?.length
})

// Handle options click from preview player
const handleOptionsClick = () => {
  // TODO: Implement options menu (playback speed, loop, etc.)
}

// Handle node execution output for output nodes
function handleNodeExecuted(message: AudioOutputMessage) {
  if (!message.audio || message.audio.length === 0) return

  const audio = message.audio[0]
  if (audioPreviewRef.value) {
    const audioUrl = api.apiURL(
      getResourceURL(audio.subfolder, audio.filename, audio.type)
    )
    audioPreviewRef.value.loadAudioFromUrl(audioUrl)
  }
}

// Reactive audio file path from widget
const audioFilePath = ref<string | null>(null)

// Load audio when widget value changes (with nextTick to ensure ref is ready)
watch(audioFilePath, async (newAudioPath) => {
  if (!newAudioPath) return

  // Wait for next tick to ensure component ref is ready
  await nextTick()

  if (!audioPreviewRef.value) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  if (audioPreviewRef.value) {
    const audioUrl = getAudioUrlFromPath(newAudioPath)
    audioPreviewRef.value.loadAudioFromUrl(audioUrl)
  }
})

// Serialization support for workflow saving - route based on widget type
async function serializeValue() {
  // For recording widgets, delegate to the record audio component
  if (audioWidgetType.value === 'record' && recordAudioRef.value) {
    return await recordAudioRef.value.serializeValue()
  }

  // For LoadAudio and other widget types, return the current audio file path
  return audioFilePath.value || modelValue.value || ''
}

// Register serialization directly on the LiteGraph widget
function registerWidgetSerialization() {
  const nodeClass =
    props.nodeData?.constructor?.comfyClass ||
    props.node?.constructor?.comfyClass ||
    props.nodeData?.type ||
    props.node?.type ||
    ''

  // Only register for RecordAudio and LoadAudio nodes
  if (!['RecordAudio', 'LoadAudio'].includes(nodeClass)) return

  // In Vue rendering mode, we need to find the LiteGraph node from app.graph
  let litegraphNode: LGraphNode | undefined = props.node

  if (!litegraphNode && props.nodeData?.id && app.graph) {
    // Find node by ID in the graph
    litegraphNode = app.graph.getNodeById(props.nodeData.id) as LGraphNode
  }

  if (!litegraphNode?.widgets) return

  // Both RecordAudio and LoadAudio use the 'audio' widget for serialization
  const targetWidget = litegraphNode.widgets.find(
    (w: any) => w.name === 'audio'
  )

  if (targetWidget) {
    targetWidget.serializeValue = serializeValue
  }
}

// Unregister serialization on cleanup
function unregisterWidgetSerialization() {
  const litegraphNode = props.node
  if (!litegraphNode?.widgets) return

  const targetWidget = litegraphNode.widgets.find(
    (w: any) => w.name === 'audio'
  )

  if (targetWidget && targetWidget.serializeValue === serializeValue) {
    delete targetWidget.serializeValue
  }
}

// Watch node outputs store for audio updates (for Vue nodes)
watch(
  () => {
    if (!nodeLocatorId.value) return null
    return nodeOutputStore.nodeOutputs[nodeLocatorId.value]
  },
  (nodeOutput) => {
    if (!nodeOutput?.audio || nodeOutput.audio.length === 0) return

    const audio = nodeOutput.audio[0]
    if (audioPreviewRef.value && audio.filename) {
      const audioUrl = api.apiURL(
        getResourceURL(
          audio.subfolder || '',
          audio.filename,
          audio.type || 'output'
        )
      )
      audioPreviewRef.value.loadAudioFromUrl(audioUrl)
    }
  }
)

// Watch nodeData.widgets array directly with deep watching
watch(
  () => {
    // Return a new object each time to force re-evaluation
    const widgets = props.nodeData?.widgets
    if (!widgets) return null

    const audioWidget = widgets.find((w: any) => w.name === 'audio')
    return {
      value: audioWidget?.value,
      timestamp: Date.now()
    }
  },
  (data) => {
    if (data?.value && data.value !== audioFilePath.value) {
      audioFilePath.value = data.value as string
    }
  },
  { immediate: true, flush: 'post' }
)

// Setup execution handler for output nodes (litegraph compatibility)
watch(
  () => props.node,
  (node) => {
    if (!node || !isOutputNode.value) return

    const originalOnExecuted = node.onExecuted
    node.onExecuted = function (message: any) {
      if (originalOnExecuted) {
        originalOnExecuted.call(this, message)
      }
      handleNodeExecuted(message)
    }
  },
  { immediate: true }
)

// Register serialization on mount (after app.graph is available)
onMounted(() => {
  registerWidgetSerialization()
})

// Cleanup
onUnmounted(() => {
  unregisterWidgetSerialization()
})

// Expose methods for parent component to use
defineExpose({
  serializeValue
})
</script>
