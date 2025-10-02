<template>
  <div
    :class="
      cn(
        'bg-zinc-500/10 dark-theme:bg-node-component-surface box-border flex gap-4 items-center justify-start relative rounded-lg w-full h-16 px-4 py-0',
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
        class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-black/10 dark-theme:hover:bg-white/10"
        @click="togglePlayPause"
      >
        <i
          v-if="!isPlaying"
          class="icon-[lucide--play] size-4 text-gray-600 dark-theme:text-[#8a8a8a]"
        />
        <i
          v-else
          class="icon-[lucide--pause] size-4 text-gray-600 dark-theme:text-[#8a8a8a]"
        />
      </div>

      <!-- Time Display -->
      <div
        class="text-sm font-normal text-black dark-theme:text-white text-nowrap"
      >
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>
    </div>

    <!-- Progress Bar -->
    <div
      class="flex-1 h-0.5 bg-gray-300 dark-theme:bg-[#444444] rounded-full relative"
    >
      <div
        class="absolute left-0 top-0 h-full bg-gray-600 dark-theme:bg-white/50 rounded-full transition-all"
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
        class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-black/10 dark-theme:hover:bg-white/10"
        @click="toggleMute"
      >
        <i
          v-if="!isMuted && volume > 0.5"
          class="icon-[lucide--volume-2] size-4 text-gray-600 dark-theme:text-[#8a8a8a]"
        />
        <i
          v-else-if="!isMuted && volume > 0"
          class="icon-[lucide--volume-1] size-4 text-gray-600 dark-theme:text-[#8a8a8a]"
        />
        <i
          v-else
          class="icon-[lucide--volume-x] size-4 text-gray-600 dark-theme:text-[#8a8a8a]"
        />
      </div>

      <!-- Options Button -->
      <div
        v-if="showOptionsButton"
        ref="optionsButtonRef"
        role="button"
        :tabindex="0"
        aria-label="More Options"
        class="size-6 flex items-center justify-center cursor-pointer rounded hover:bg-black/10 dark-theme:hover:bg-white/10"
        @click="toggleOptionsMenu"
      >
        <i
          class="icon-[lucide--more-vertical] size-4 text-gray-600 dark-theme:text-[#8a8a8a]"
        />
      </div>
    </div>

    <!-- Options Menu -->
    <TieredMenu
      ref="optionsMenu"
      :model="menuItems"
      popup
      class="audio-player-menu"
      pt:root:class="!bg-white dark-theme:!bg-charcoal-800 !border-sand-100 dark-theme:!border-charcoal-600"
      pt:submenu:class="!bg-white dark-theme:!bg-charcoal-800"
    >
      <template #item="{ item }">
        <div v-if="item.key === 'volume'" class="px-4 py-2 w-48">
          <label class="text-xs text-black dark-theme:text-white mb-2 block">{{
            item.label
          }}</label>
          <Slider
            :model-value="volume * 10"
            :min="0"
            :max="10"
            :step="1"
            class="w-full"
            @update:model-value="handleVolumeChange"
          />
        </div>
        <div
          v-else
          class="flex items-center px-4 py-2 cursor-pointer hover:bg-white/10 text-xs"
          @click="item.onClick?.()"
        >
          <span class="text-black dark-theme:text-white">{{ item.label }}</span>
          <i
            v-if="item.selected"
            class="icon-[lucide--check] size-4 text-black dark-theme:text-white ml-auto"
          />
        </div>
      </template>
    </TieredMenu>
  </div>
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import TieredMenu from 'primevue/tieredmenu'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import { formatTime } from '../../utils/audioUtils'

const { t } = useI18n()

defineProps<{
  readonly?: boolean
  hideWhenEmpty?: boolean
  showOptionsButton?: boolean
}>()

// Refs
const audioRef = ref<HTMLAudioElement>()
const optionsMenu = ref()
const optionsButtonRef = ref<HTMLElement>()
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const hasAudio = ref(false)
const playbackRate = ref(1)

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

// Options menu
const toggleOptionsMenu = (event: Event) => {
  optionsMenu.value?.toggle(event)
}

const setPlaybackSpeed = (speed: number) => {
  playbackRate.value = speed
  if (audioRef.value) {
    audioRef.value.playbackRate = speed
  }
}

const handleVolumeChange = (value: number | number[]) => {
  const numValue = Array.isArray(value) ? value[0] : value
  volume.value = numValue / 10
  if (audioRef.value) {
    audioRef.value.volume = volume.value
    if (volume.value > 0 && isMuted.value) {
      isMuted.value = false
      audioRef.value.muted = false
    }
  }
}

const menuItems = computed(() => [
  {
    label: t('g.playbackSpeed'),
    items: [
      {
        label: t('g.halfSpeed'),
        onClick: () => setPlaybackSpeed(0.5),
        selected: playbackRate.value === 0.5
      },
      {
        label: t('g.1x'),
        onClick: () => setPlaybackSpeed(1),
        selected: playbackRate.value === 1
      },
      {
        label: t('g.2x'),
        onClick: () => setPlaybackSpeed(2),
        selected: playbackRate.value === 2
      }
    ]
  },
  {
    label: t('g.volume'),
    key: 'volume'
  }
])

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

<style scoped>
.audio-player-menu {
  --p-tieredmenu-item-focus-background: rgba(255, 255, 255, 0.1);
  --p-tieredmenu-item-active-background: rgba(255, 255, 255, 0.1);
}
</style>
