<template>
  <div
    :class="
      cn(
        'bg-[#262729] box-border flex gap-4 items-center justify-start relative rounded-lg w-full h-16 px-4 py-0',
        { hidden: hideWhenEmpty && !hasAudio }
      )
    "
  >
    <!-- Hidden audio element -->
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

      <!-- Options Button -->
      <div
        v-if="showOptionsButton"
        role="button"
        :tabindex="0"
        aria-label="More Options"
        class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-white/10"
        @click="$emit('options-click')"
      >
        <i class="icon-[lucide--more-vertical] size-4 text-[#8a8a8a]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { formatTime } from '../../utils/audioUtils'

defineProps<{
  readonly?: boolean
  hideWhenEmpty?: boolean
  showOptionsButton?: boolean
}>()

defineEmits<{
  'options-click': []
}>()

// Refs
const audioRef = ref<HTMLAudioElement>()
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const hasAudio = ref(false)

// Computed
const progressPercentage = computed(() => {
  if (!duration.value || duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// Playback controls
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

const handleSeek = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (audioRef.value && duration.value > 0) {
    const newTime = (value / 100) * duration.value
    audioRef.value.currentTime = newTime
    currentTime.value = newTime
  }
}

// Audio events
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

const handleEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

// Public methods
const loadAudioFromUrl = (url: string) => {
  if (!audioRef.value) return

  audioRef.value.src = url
  audioRef.value.load()
  hasAudio.value = true
}

// Cleanup
onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.src = ''
  }
})

// Expose methods for parent component
defineExpose({
  loadAudioFromUrl,
  hasAudio
})
</script>
