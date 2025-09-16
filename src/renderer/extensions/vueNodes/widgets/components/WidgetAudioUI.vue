<template>
  <div
    class="bg-node-component-surface box-border flex gap-4 items-center justify-start relative rounded-md w-full h-16 p-4"
  >
    <!-- Hidden audio input for file upload -->
    <!-- <input
      ref="audioInputRef"
      type="file"
      accept="audio/*"
      class="hidden"
      @change="handleFileChange"
    /> -->

    <!-- Hidden audio element for playback -->
    <audio
      ref="audioRef"
      @loadedmetadata="handleLoadedMetadata"
      @timeupdate="handleTimeUpdate"
      @ended="handleEnded"
    />

    <!-- Left Actions -->
    <div class="flex gap-2 items-center justify-start relative shrink-0">
      <!-- Play/Pause Button -->
      <div
        role="button"
        :tabindex="0"
        aria-label="Play/Pause"
        class="flex items-center justify-center cursor-pointer"
        @click="togglePlayPause"
      >
        <i v-if="!isPlaying" class="icon-[lucide--play] size-4 text-gray-800" />
        <i v-else class="icon-[lucide--pause] size-4 text-gray-800" />
      </div>

      <!-- Time Display -->
      <div class="font-normal relative shrink-0 text-nowrap text-white">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>
    </div>

    <!-- Progress Slider -->
    <div
      class="flex-1 flex items-center justify-center min-h-px min-w-px relative"
    >
      <Slider
        v-model="sliderValue"
        :min="0"
        :max="100"
        :step="0.1"
        class="w-full"
        @update:model-value="handleSliderChange"
      />
    </div>

    <!-- Right Actions -->
    <div class="flex gap-2 items-center justify-start relative shrink-0">
      <!-- Volume Button -->
      <div
        role="button"
        :tabindex="0"
        aria-label="Play/Pause"
        class="flex items-center justify-center cursor-pointer"
        @click="toggleMute"
      >
        <i
          v-if="!isMuted && volume > 0.5"
          class="icon-[lucide--volume-2] size-4 text-gray-800"
        />
        <i
          v-else-if="!isMuted && volume > 0"
          class="icon-[lucide--volume-1] size-4 text-gray-800"
        />
        <i v-else class="icon-[lucide--volume-x] size-4 text-gray-800" />
      </div>

      <!-- Options Button -->
      <div
        role="button"
        :tabindex="0"
        aria-label="More Options"
        class="flex items-center justify-center cursor-pointer"
        @click="handleOptionsClick"
      >
        <i
          class="icon-[lucide--more-vertical] size-4 text-gray-800 text-button-icon"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

interface NodeDataType {
  widgets?: Array<{
    name: string
    type: string
    value: any
    options?: any
  }>
}

const props = defineProps<{
  widget?: any
  modelValue?: any
  readonly?: boolean
  nodeData?: NodeDataType
}>()

// const modelValue = defineModel<File | null>('modelValue') // Not needed since we load from server

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
  type: string = 'input'
): string {
  const params = [
    'filename=' + encodeURIComponent(filename),
    'type=' + type,
    'subfolder=' + subfolder,
    app.getRandParam().substring(1)
  ].join('&')

  return `/view?${params}`
}

// Log the node data to understand structure
console.log('WidgetAudioUI - nodeData:', props.nodeData)
console.log('WidgetAudioUI - widget:', props.widget)

// Find the audio combo widget to get the selected file
const audioFileName = computed(() => {
  if (!props.nodeData?.widgets) return null

  const audioWidget = props.nodeData.widgets.find(
    (w) => w.name === 'audio' && w.type === 'combo'
  )
  console.log('Found audio widget:', audioWidget)

  return audioWidget?.value || null
})

// const audioInputRef = ref<HTMLInputElement>() // Not needed since input is disabled
const audioRef = ref<HTMLAudioElement>()
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const sliderValue = ref<number[]>([0])
const isSliderDragging = ref(false)

// Commented out since we're loading from server, not file upload
// const handleFileChange = (event: Event) => {
//   const target = event.target as HTMLInputElement
//   const file = target.files?.[0]

//   if (file && audioRef.value) {
//     modelValue.value = file
//     const url = URL.createObjectURL(file)
//     audioRef.value.src = url
//     audioRef.value.load()
//   }
// }

const handleLoadedMetadata = () => {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
  }
}

const handleTimeUpdate = () => {
  if (audioRef.value && !isSliderDragging.value) {
    currentTime.value = audioRef.value.currentTime
    const progress = (currentTime.value / duration.value) * 100
    sliderValue.value = [isNaN(progress) ? 0 : progress]
  }
}

const handleEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
  sliderValue.value = [0]
}

const handleSliderChange = (value: number[] | undefined) => {
  if (value && audioRef.value && duration.value > 0) {
    const newTime = (value[0] / 100) * duration.value
    audioRef.value.currentTime = newTime
    currentTime.value = newTime
  }
}

const togglePlayPause = () => {
  if (!audioRef.value || !audioRef.value.src) {
    // If no audio loaded, do nothing for now
    // TODO: Could show a message or load default audio
    console.log('No audio loaded')
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
  // Options button functionality
  // TODO: Could implement playback speed, loop, etc.
  console.log('Options clicked')
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds === 0) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Watch for audio file changes and load the audio
watch(
  audioFileName,
  (newFileName) => {
    console.log('Audio filename changed:', newFileName)
    if (newFileName && audioRef.value) {
      const [subfolder, filename] = splitFilePath(newFileName)
      const audioUrl = api.apiURL(getResourceURL(subfolder, filename))
      console.log('Loading audio from URL:', audioUrl)

      audioRef.value.src = audioUrl
      audioRef.value.load()
    }
  },
  { immediate: true }
)

// Load audio on mount if filename is available
onMounted(() => {
  if (audioFileName.value && audioRef.value) {
    const [subfolder, filename] = splitFilePath(audioFileName.value)
    const audioUrl = api.apiURL(getResourceURL(subfolder, filename))
    console.log('Loading audio on mount from URL:', audioUrl)

    audioRef.value.src = audioUrl
    audioRef.value.load()
  }
})

// Cleanup
onUnmounted(() => {
  // Note: We don't revoke URLs here since they're not blob URLs
  // They're server URLs that don't need cleanup
})
</script>
