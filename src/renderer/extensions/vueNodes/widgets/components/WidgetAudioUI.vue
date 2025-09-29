<template>
  <div class="w-full">
    <WidgetRecordAudio
      v-if="audioWidgetType === 'record'"
      ref="recordAudioRef"
      :widget="widget"
      :model-value="modelValue"
      :readonly="readonly"
      :node-data="nodeData"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <AudioPreviewPlayer
      v-else
      ref="audioPreviewRef"
      :readonly="readonly"
      :hide-when-empty="isOutputNode"
      :show-options-button="true"
      @options-click="handleOptionsClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { getLocatorIdFromNodeData } from '@/utils/graphTraversalUtil'

import { getAudioUrlFromPath, getResourceURL } from '../utils/audioUtils'
import WidgetRecordAudio from './WidgetRecordAudio.vue'
import AudioPreviewPlayer from './audio/AudioPreviewPlayer.vue'

const props = defineProps<{
  widget?: any
  readonly?: boolean
  nodeData?: any
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
  const fromNode = props.nodeData?.output_node === true

  const nodeClass =
    props.nodeData?.constructor?.comfyClass || props.nodeData?.type || 'Unknown'

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
    props.nodeData?.constructor?.comfyClass || props.nodeData?.type || ''
  if (nodeClass === 'RecordAudio') {
    return 'record'
  }
  return 'preview'
})

const nodeLocatorId = computed(() => {
  if (!props.nodeData) return null
  return getLocatorIdFromNodeData(props.nodeData as any)
})

const nodeOutputStore = useNodeOutputStore()

// Handle options click from preview player
const handleOptionsClick = () => {
  // TODO: Implement options menu (playback speed, loop, etc.)
}

const audioFilePath = ref<string | null>(null)

watch(audioFilePath, async (newAudioPath) => {
  if (!newAudioPath) return
  await nextTick()
  if (audioPreviewRef.value) {
    const audioUrl = getAudioUrlFromPath(newAudioPath)
    audioPreviewRef.value.loadAudioFromUrl(audioUrl)
  }
})

async function serializeValue() {
  if (audioWidgetType.value === 'record' && recordAudioRef.value) {
    return await recordAudioRef.value.serializeValue()
  }
  return audioFilePath.value || modelValue.value || ''
}

function registerWidgetSerialization() {
  const nodeClass =
    props.nodeData?.constructor?.comfyClass || props.nodeData?.type || ''
  if (!['RecordAudio', 'LoadAudio'].includes(nodeClass)) return

  let litegraphNode: LGraphNode | undefined = undefined

  if (props.nodeData?.id && app.rootGraph) {
    litegraphNode = app.rootGraph.getNodeById(props.nodeData.id) as LGraphNode
  }

  if (!litegraphNode?.widgets) return

  const targetWidget = litegraphNode.widgets.find(
    (w: IBaseWidget) => w.name === 'audio'
  )
  if (targetWidget) {
    targetWidget.serializeValue = serializeValue
  }
}

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

watch(
  () => {
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

onMounted(() => {
  registerWidgetSerialization()
})
</script>
