<template>
  <div class="w-full">
    <WidgetSelect
      v-if="audioWidgetType == 'preview'"
      v-model="modelValue"
      :widget="props.widget"
    />
    <p v-if="audioWidgetType == 'preview'" class="my-4"></p>
    <WidgetRecordAudio
      v-if="audioWidgetType === 'record'"
      ref="recordAudioRef"
      :widget="props.widget!"
      :model-value="modelValue"
      :readonly="readonly"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <AudioPreviewPlayer
      v-else
      ref="audioPreviewRef"
      :readonly="readonly"
      :hide-when-empty="isOutputNode"
      :show-options-button="true"
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
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getLocatorIdFromNodeData } from '@/utils/graphTraversalUtil'

import { getAudioUrlFromPath, getResourceURL } from '../utils/audioUtils'
import WidgetRecordAudio from './WidgetRecordAudio.vue'
import WidgetSelect from './WidgetSelect.vue'
import AudioPreviewPlayer from './audio/AudioPreviewPlayer.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()

const modelValue = defineModel<any>('modelValue')

defineEmits<{
  'update:modelValue': [value: any]
}>()

// Refs
const audioPreviewRef = ref<InstanceType<typeof AudioPreviewPlayer>>()
const recordAudioRef = ref<InstanceType<typeof WidgetRecordAudio>>()

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

const audioWidgetType = computed(() => {
  const node = litegraphNode.value
  if (!node) return 'preview'

  const nodeClass = node.constructor?.comfyClass || node.type || ''
  if (nodeClass === 'RecordAudio') {
    return 'record'
  }
  return 'preview'
})

const nodeLocatorId = computed(() => {
  const node = litegraphNode.value
  if (!node) return null
  return getLocatorIdFromNodeData(node)
})

const nodeOutputStore = useNodeOutputStore()

const audioFilePath = computed(() => props.widget.value as string)

watch(
  audioFilePath,
  async (newPath) => {
    if (!newPath) return

    await nextTick()
    const audioUrl = getAudioUrlFromPath(newPath, 'input')
    if (!audioPreviewRef.value) return
    audioPreviewRef.value.loadAudioFromUrl(audioUrl)
  },
  { immediate: true }
)

async function serializeValue() {
  if (audioWidgetType.value === 'record' && recordAudioRef.value) {
    return await recordAudioRef.value.serializeValue()
  }
  return audioFilePath.value || modelValue.value || ''
}

function registerWidgetSerialization() {
  const node = litegraphNode.value
  if (!node) return

  const nodeClass = node.constructor?.comfyClass || node.type || ''
  if (!['RecordAudio', 'LoadAudio'].includes(nodeClass)) return

  if (!node.widgets) return

  const targetWidget = node.widgets.find((w: IBaseWidget) => w.name === 'audio')
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

onMounted(() => {
  registerWidgetSerialization()
})
</script>
