<template>
  <div class="w-full">
    <!-- Standard Audio UI -->
    <div
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
        @loadedmetadata="handleLoadedMetadata"
        @timeupdate="handleTimeUpdate"
        @ended="handleEnded"
      />

      <!-- Recording Mode -->
      <template v-if="isRecording">
        <!-- Recording Feedback -->
        <div class="flex gap-2 items-center justify-start relative shrink-0">
          <div class="text-xs text-white">
            {{ t('g.listening') || 'Listening...' }}
          </div>
          <div class="text-sm text-white font-normal">
            {{ formatTime(recordingTime) }}
          </div>
        </div>

        <!-- Waveform Visualization -->
        <div class="flex-1 flex gap-2 items-center justify-start h-8 min-w-0">
          <div
            v-for="i in waveformBars"
            :key="i"
            class="w-0.5 bg-gray-500 rounded transition-all duration-75"
            :style="{ height: `${getWaveformHeight(i)}px` }"
          />
        </div>

        <!-- Stop Recording Button -->
        <div
          role="button"
          :tabindex="0"
          aria-label="Stop Recording"
          class="bg-red-500/20 rounded-full size-8 flex items-center justify-center cursor-pointer hover:bg-red-500/30"
          @click="stopRecording"
        >
          <i class="icon-[lucide--square] size-4 text-red-500" />
        </div>
      </template>

      <!-- Playback Mode -->
      <template v-else>
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

          <!-- Record Button (optional) -->
          <div
            v-if="showRecordButton"
            role="button"
            :tabindex="0"
            aria-label="Start Recording"
            class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-white/10"
            @click="startRecording"
          >
            <i class="icon-[lucide--mic] size-4 text-[#8a8a8a]" />
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
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MediaRecorder as ExtendableMediaRecorder } from 'extendable-media-recorder'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAudioService } from '@/services/audioService'
import { cn } from '@/utils/tailwindUtil'

interface NodeDataType {
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
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const hasAudio = ref(false)

// Recording state
const isRecording = ref(false)
const recordingTime = ref(0)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
const currentStream = ref<MediaStream | null>(null)
const recordingInterval = ref<number | null>(null)
const waveformBars = ref<number[]>(Array(30).fill(16)) // Waveform bars array

// Check if this is an output node (PreviewAudio, SaveAudio, etc)
const isOutputNode = computed(() => {
  return props.nodeData?.output_node === true
})

// Check if we should show upload functionality
const showUploadButton = computed(() => {
  // Show upload button if there's an AUDIOUPLOAD widget on the same node
  return props.nodeData?.widgets?.some((w) => w.type === 'AUDIOUPLOAD') ?? false
})

// Check if we should show record functionality
const showRecordButton = computed(() => {
  // Show record button if there's an AUDIO_RECORD widget on the same node
  return (
    props.nodeData?.widgets?.some((w) => w.type === 'AUDIO_RECORD') ?? false
  )
})

// Progress percentage for the seek bar
const progressPercentage = computed(() => {
  if (!duration.value || duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// Widget classes - hide when no audio for output nodes
const widgetClasses = computed(() => {
  return cn(
    'bg-[#262729] box-border flex gap-4 items-center justify-start relative rounded-lg w-full h-16 px-4 py-0',
    {
      'empty-audio-widget':
        isOutputNode.value && !hasAudio.value && !isRecording.value
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
        // Update value
        audioWidget.value = path
      }

      // Load the audio
      loadAudioFromPath(path)

      // Update model value
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

// Get waveform bar height for inline recording visualization
const getWaveformHeight = (index: number): number => {
  // Simple animated waveform during recording
  const base = Math.sin(Date.now() / 200 + index) * 0.5 + 0.5
  return 4 + base * 28
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
  // Options button functionality - could implement playback speed, loop, etc.
}

// Recording functions
async function startRecording() {
  try {
    // Reset previous recording
    audioChunks.value = []
    recordingTime.value = 0

    // Register WAV encoder if needed
    await useAudioService().registerWavEncoder()

    // Get user media
    currentStream.value = await navigator.mediaDevices.getUserMedia({
      audio: true
    })

    // Create media recorder
    mediaRecorder.value = new ExtendableMediaRecorder(currentStream.value, {
      mimeType: 'audio/wav'
    }) as unknown as MediaRecorder

    // Set up event handlers
    mediaRecorder.value.ondataavailable = (event) => {
      audioChunks.value.push(event.data)
    }

    mediaRecorder.value.onstop = async () => {
      // Create blob from chunks
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/wav' })

      // Stop all tracks
      useAudioService().stopAllTracks(currentStream.value)
      currentStream.value = null

      // Convert and upload
      const path = await useAudioService().convertBlobToFileAndSubmit(audioBlob)

      // Update audio widget value if exists
      const audioWidget = props.nodeData?.widgets?.find(
        (w) => w.name === 'audio'
      )
      if (audioWidget) {
        audioWidget.value = path
      }

      // Load the recorded audio
      loadAudioFromPath(path)
      modelValue.value = path

      isRecording.value = false
      clearInterval(recordingInterval.value!)
    }

    mediaRecorder.value.onerror = (event) => {
      console.error('MediaRecorder error:', event)
      stopRecording()
      useToastStore().addAlert(t('g.recordingError') || 'Recording error')
    }

    // Start recording
    mediaRecorder.value.start()
    isRecording.value = true

    // Start timer
    recordingInterval.value = window.setInterval(() => {
      recordingTime.value += 1
    }, 1000)
  } catch (err) {
    console.error('Error accessing microphone:', err)
    useToastStore().addAlert(
      t('g.micPermissionDenied') || 'Microphone permission denied'
    )
  }
}

function stopRecording() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  } else {
    // Cleanup if stop was called without active recording
    useAudioService().stopAllTracks(currentStream.value)
    currentStream.value = null
    isRecording.value = false
    clearInterval(recordingInterval.value!)
  }
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

// Serialization support for workflow saving
function serializeValue() {
  // Return the current audio file path or empty string
  return audioFileName.value || ''
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

// Setup node execution handler for output nodes
watch(
  () => props.node,
  (node) => {
    if (!node || !isOutputNode.value) return

    // Store original onExecuted
    const originalOnExecuted = node.onExecuted

    // Override onExecuted to handle audio output
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

// Cleanup
onUnmounted(() => {
  // Stop recording if active
  if (isRecording.value) {
    stopRecording()
  }

  // Pause audio and clear source
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }

  // Clear recording interval
  if (recordingInterval.value) {
    clearInterval(recordingInterval.value)
  }

  // Stop stream tracks
  if (currentStream.value) {
    currentStream.value.getTracks().forEach((track) => track.stop())
  }

  // Restore original onExecuted if we modified it
  if (props.node && isOutputNode.value) {
    // Note: The original is already stored in the closure
  }
})

// Expose methods for parent component to use
defineExpose({
  serializeValue,
  loadAudioFromPath,
  hasAudio
})
</script>

<style scoped>
.empty-audio-widget {
  display: none;
}
</style>
