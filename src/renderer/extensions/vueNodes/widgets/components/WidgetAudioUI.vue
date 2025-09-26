<template>
  <div class="w-full">
    <!-- Route to appropriate sub-widget based on audio widget type -->

    <!-- Recording Widget for AUDIO_RECORD types -->
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

    <!-- Upload-focused UI for AUDIOUPLOAD types -->
    <div
      v-else-if="audioWidgetType === 'upload'"
      :class="
        cn(
          'bg-[#262729] box-border flex gap-4 items-center justify-start relative rounded-lg w-full h-16 px-4 py-0'
        )
      "
      @dragover="handleDragOver"
      @drop="handleDrop"
      @paste="handlePaste"
    >
      <!-- Hidden audio input for file upload -->
      <input
        ref="audioInputRef"
        type="file"
        accept="audio/*"
        class="hidden"
        @change="handleFileChange"
      />

      <!-- Upload UI with prominent upload button -->
      <div class="flex items-center gap-2 flex-1">
        <i class="icon-[lucide--upload] size-4 text-[#8a8a8a]" />
        <span class="text-white text-sm">{{
          audioFileName || 'Drop audio file or click to upload'
        }}</span>
      </div>

      <button
        class="px-3 py-1 bg-[#444] text-white rounded text-sm hover:bg-[#555]"
        @click="openFileSelection"
      >
        {{ t('upload', 'Upload') }}
      </button>
    </div>

    <!-- Preview/Playback UI for preview types (default) -->
    <div
      v-else
      :class="widgetClasses"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @paste="handlePaste"
    >
      <!-- Hidden audio input for file upload -->
      <input
        ref="audioInputRef"
        type="file"
        accept="audio/*"
        class="hidden"
        @change="handleFileChange"
      />

      <!-- Hidden audio element for playback -->
      <audio
        ref="audioRef"
        key="nodeData"
        @loadedmetadata="handleLoadedMetadata"
        @timeupdate="handleTimeUpdate"
        @ended="handleEnded"
      />

      <!-- Playback Mode -->
      <!-- Left Actions -->
      <div class="flex gap-2 items-center justify-start relative shrink-0">
        <!-- Play/Pause Button -->
        <div
          role="button"
          :tabindex="0"
          aria-label="Play/Pause"
          class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-white/10"
          @click="togglePlayPause"
        >
          <i
            v-if="!isPlaying"
            class="icon-[lucide--play] size-4 text-[#8a8a8a]"
          />
          <i v-else class="icon-[lucide--pause] size-4 text-[#8a8a8a]" />
        </div>

        <!-- Time Display -->
        <div class="text-sm font-normal text-white text-nowrap">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="flex-1 h-0.5 bg-[#444444] rounded-full relative">
        <div
          class="absolute left-0 top-0 h-full bg-white/50 rounded-full transition-all"
          :style="{ width: `${progressPercentage}%` }"
        />
        <input
          type="range"
          :value="progressPercentage"
          min="0"
          max="100"
          step="0.1"
          class="absolute inset-0 w-full opacity-0 cursor-pointer"
          @input="handleSeek"
        />
      </div>

      <!-- Right Actions -->
      <div class="flex gap-2 items-center justify-start relative shrink-0">
        <!-- Volume Button -->
        <div
          role="button"
          :tabindex="0"
          aria-label="Volume"
          class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-white/10"
          @click="toggleMute"
        >
          <i
            v-if="!isMuted && volume > 0.5"
            class="icon-[lucide--volume-2] size-4 text-[#8a8a8a]"
          />
          <i
            v-else-if="!isMuted && volume > 0"
            class="icon-[lucide--volume-1] size-4 text-[#8a8a8a]"
          />
          <i v-else class="icon-[lucide--volume-x] size-4 text-[#8a8a8a]" />
        </div>

        <!-- Upload Button (optional) -->
        <div
          v-if="showUploadButton"
          role="button"
          :tabindex="0"
          aria-label="Upload Audio"
          class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-white/10"
          @click="openFileSelection"
        >
          <i class="icon-[lucide--upload] size-4 text-[#8a8a8a]" />
        </div>

        <!-- Options Button -->
        <div
          role="button"
          :tabindex="0"
          aria-label="More Options"
          class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-white/10"
          @click="handleOptionsClick"
        >
          <i class="icon-[lucide--more-vertical] size-4 text-[#8a8a8a]" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import {
  registerVueWidgetSerialization,
  unregisterVueWidgetSerialization
} from '@/stores/vueWidgetSerializationStore'
import { getLocatorIdFromNodeData } from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import WidgetRecordAudio from './WidgetRecordAudio.vue'

interface NodeDataType {
  id?: string | number
  widgets?: Array<{
    name: string
    type: string
    value: any
    options?: any
  }>
  output_node?: boolean
  nodeData?: any
  constructor?: {
    comfyClass?: string
  }
  type?: string
  title?: string
}

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
  nodeData?: NodeDataType
  node?: LGraphNode
}>()

const modelValue = defineModel<any>('modelValue')

defineEmits<{
  'update:modelValue': [value: any]
}>()

// Helper function to split file path
function splitFilePath(path: string): [string, string] {
  const folder_separator = path.lastIndexOf('/')
  if (folder_separator === -1) {
    return ['', path]
  }
  return [
    path.substring(0, folder_separator),
    path.substring(folder_separator + 1)
  ]
}

// Helper function to get resource URL
function getResourceURL(
  subfolder: string,
  filename: string,
  type: ResultItemType = 'input'
): string {
  const params = [
    'filename=' + encodeURIComponent(filename),
    'type=' + type,
    'subfolder=' + subfolder,
    app.getRandParam().substring(1)
  ].join('&')

  return `/view?${params}`
}

// Refs
const audioInputRef = ref<HTMLInputElement>()
const audioRef = ref<HTMLAudioElement>()
const recordAudioRef = ref<InstanceType<typeof WidgetRecordAudio>>()
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const hasAudio = ref(false)

// Audio playback state only

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

// Audio widget type detection based on exact uploadAudio.ts patterns for workflow compatibility
const audioWidgetType = computed(() => {
  // Debug logging to help identify widget detection
  const nodeClass =
    props.nodeData?.constructor?.comfyClass ||
    props.node?.constructor?.comfyClass ||
    props.nodeData?.type ||
    props.node?.type ||
    'Unknown'

  // PRIORITY 1: Check the current widget's type first (for workflow compatibility)
  if (props.widget?.type === 'AUDIO_RECORD') {
    return 'record'
  }

  if (props.widget?.type === 'AUDIOUPLOAD') {
    return 'upload'
  }

  if (props.widget?.type === 'AUDIOUI') {
    return 'preview'
  }

  // PRIORITY 2: Check for other audio widgets on the same node (context clues)
  const hasRecordWidget =
    props.nodeData?.widgets?.some((w) => w.type === 'AUDIO_RECORD') ?? false
  const hasUploadWidget =
    props.nodeData?.widgets?.some((w) => w.type === 'AUDIOUPLOAD') ?? false
  const hasAudioUIWidget =
    props.nodeData?.widgets?.some((w) => w.type === 'AUDIOUI') ?? false

  if (hasRecordWidget) {
    return 'record'
  }

  if (hasUploadWidget) {
    return 'upload'
  }

  // PRIORITY 3: Check node class patterns (for workflow compatibility)
  if (nodeClass === 'RecordAudio' || nodeClass.includes('Record')) {
    return 'record'
  }

  // PRIORITY 4: Check widget name patterns (for workflow compatibility)
  if (props.widget?.name === 'upload' || props.widget?.name === 'audioUpload') {
    return 'upload'
  }

  if (props.widget?.name === 'audioUI') {
    return 'preview'
  }

  if (hasAudioUIWidget) {
    return 'preview'
  }

  // Check for audio output/preview nodes
  const audioOutputNodes = [
    'LoadAudio',
    'SaveAudio',
    'PreviewAudio',
    'SaveAudioMP3',
    'SaveAudioOpus'
  ]
  if (audioOutputNodes.includes(nodeClass)) {
    return 'preview'
  }

  // Default to preview
  return 'preview'
})

// Legacy computed for backward compatibility
// const isRecordAudioNode = computed(() => audioWidgetType.value === 'record')

// Check if we should show upload functionality
const showUploadButton = computed(() => {
  // Show upload button if there's an AUDIOUPLOAD widget on the same node
  return props.nodeData?.widgets?.some((w) => w.type === 'AUDIOUPLOAD') ?? false
})

// Progress percentage for the seek bar
const progressPercentage = computed(() => {
  if (!duration.value || duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// Check if we have audio from node outputs
const hasAudioFromOutputs = computed(() => {
  if (!nodeLocatorId.value) return false
  const nodeOutput = nodeOutputStore.nodeOutputs[nodeLocatorId.value]
  return !!nodeOutput?.audio?.length
})

// Widget classes - hide when no audio for output nodes
const widgetClasses = computed(() => {
  const shouldHide =
    isOutputNode.value && !hasAudio.value && !hasAudioFromOutputs.value

  return cn(
    'bg-[#262729] box-border flex gap-4 items-center justify-start relative rounded-lg w-full h-16 px-4 py-0',
    {
      hidden: shouldHide
    }
  )
})

// Find the audio combo widget to get the selected file
const audioFileName = computed(() => {
  if (!props.nodeData?.widgets) return null

  const audioWidget = props.nodeData.widgets.find(
    (w) => w.name === 'audio' && (w.type === 'combo' || w.type === 'STRING')
  )

  return audioWidget?.value || null
})

// File upload handling
async function uploadFile(file: File, pasted = false) {
  try {
    const body = new FormData()
    body.append('image', file)
    if (pasted) body.append('subfolder', 'pasted')

    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    if (resp.status === 200) {
      const data = await resp.json()
      let path = data.name
      if (data.subfolder) path = data.subfolder + '/' + path

      // Update the audio widget value if it exists
      const audioWidget = props.nodeData?.widgets?.find(
        (w) => w.name === 'audio'
      )
      if (audioWidget) {
        // Add to options if combo widget
        if (
          audioWidget.options?.values &&
          !audioWidget.options.values.includes(path)
        ) {
          audioWidget.options.values.push(path)
        }
        audioWidget.value = path
      }

      loadAudioFromPath(path)
      modelValue.value = path
    } else {
      useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    }
  } catch (error) {
    useToastStore().addAlert(String(error))
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    void uploadFile(file, false)
  }
}

// Drag and drop handling
const handleDragOver = (event: DragEvent) => {
  if (event.dataTransfer?.items) {
    const hasAudioFile = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === 'file' && item.type.startsWith('audio/')
    )
    if (hasAudioFile) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (event.dataTransfer?.files) {
    const audioFiles = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith('audio/')
    )
    if (audioFiles.length > 0) {
      void uploadFile(audioFiles[0], false)
    }
  }
}

// Paste handling
const handlePaste = (event: ClipboardEvent) => {
  if (event.clipboardData?.files) {
    const audioFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith('audio/')
    )
    if (audioFiles.length > 0) {
      void uploadFile(audioFiles[0], true)
      event.preventDefault()
    }
  }
}

// Open file selection dialog
const openFileSelection = () => {
  audioInputRef.value?.click()
}

const handleLoadedMetadata = () => {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
    hasAudio.value = true
  }
}

const handleTimeUpdate = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

// Handle seek bar input
const handleSeek = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (audioRef.value && duration.value > 0) {
    const newTime = (value / 100) * duration.value
    audioRef.value.currentTime = newTime
    currentTime.value = newTime
  }
}

const handleEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

const togglePlayPause = () => {
  if (!audioRef.value || !audioRef.value.src) {
    return
  }

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    void audioRef.value.play()
  }
  isPlaying.value = !isPlaying.value
}

const toggleMute = () => {
  if (audioRef.value) {
    isMuted.value = !isMuted.value
    audioRef.value.muted = isMuted.value
  }
}

const handleOptionsClick = () => {
  // TODO: Implement options menu (playback speed, loop, etc.)
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds === 0) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Load audio from path
function loadAudioFromPath(path: string) {
  if (!path || !audioRef.value) return

  const [subfolder, filename] = splitFilePath(path)
  const audioUrl = api.apiURL(getResourceURL(subfolder, filename))

  audioRef.value.src = audioUrl
  audioRef.value.load()
  hasAudio.value = true
}

// Handle node execution output for output nodes
function handleNodeExecuted(message: AudioOutputMessage) {
  if (!message.audio || message.audio.length === 0) return

  const audio = message.audio[0]
  if (audioRef.value) {
    const audioUrl = api.apiURL(
      getResourceURL(audio.subfolder, audio.filename, audio.type)
    )
    audioRef.value.src = audioUrl
    audioRef.value.load()
    hasAudio.value = true
  }
}

// Serialization support for workflow saving - route based on widget type
async function serializeValue() {
  // For recording widgets, delegate to the record audio component
  if (audioWidgetType.value === 'record' && recordAudioRef.value) {
    return await recordAudioRef.value.serializeValue()
  }

  // For all other widget types, return the current audio file path
  return audioFileName.value || modelValue.value || ''
}

// Watch for audio file changes and load the audio
watch(
  audioFileName,
  (newFileName) => {
    if (newFileName) {
      loadAudioFromPath(newFileName)
    }
  },
  { immediate: true }
)

// Get node locator ID for output tracking
const nodeLocatorId = computed(() => {
  if (!props.nodeData) return null
  return getLocatorIdFromNodeData(props.nodeData as any)
})

// Watch node outputs store for audio updates (for Vue nodes)
const nodeOutputStore = useNodeOutputStore()

watch(
  () => {
    if (!nodeLocatorId.value) return null
    return nodeOutputStore.nodeOutputs[nodeLocatorId.value]
  },
  (nodeOutput) => {
    if (!nodeOutput?.audio || nodeOutput.audio.length === 0) return

    const audio = nodeOutput.audio[0]
    if (audioRef.value && audio.filename) {
      const audioUrl = api.apiURL(
        getResourceURL(
          audio.subfolder || '',
          audio.filename,
          audio.type || 'output'
        )
      )
      audioRef.value.src = audioUrl
      audioRef.value.load()
      hasAudio.value = true
    }
  }
)

// Setup node execution handler for output nodes (for litegraph compatibility)
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

// Load audio on mount if filename is available
onMounted(() => {
  if (audioFileName.value) {
    loadAudioFromPath(audioFileName.value)
  }
})

// Register serialization function for RecordAudio nodes
const nodeId = computed(() => props.nodeData?.id || props.node?.id)
const registrationKey = computed(() =>
  nodeId.value ? `${nodeId.value}-audioUI` : null
)

// Watch for audioWidgetType changes and register/unregister appropriately
watch(
  [audioWidgetType, registrationKey],
  ([widgetType, key], [prevWidgetType, prevKey]) => {
    // Unregister previous key if it exists
    if (prevKey && prevWidgetType === 'record') {
      unregisterVueWidgetSerialization(prevKey)
    }

    // Register new key if it's a record widget
    if (widgetType === 'record' && key) {
      registerVueWidgetSerialization(key, serializeValue)
    }
  },
  { immediate: true }
)

// Cleanup
onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }

  // Unregister serialization function
  if (registrationKey.value) {
    unregisterVueWidgetSerialization(registrationKey.value)
  }
})

// Expose methods for parent component to use
defineExpose({
  serializeValue,
  loadAudioFromPath,
  hasAudio
})
</script>
