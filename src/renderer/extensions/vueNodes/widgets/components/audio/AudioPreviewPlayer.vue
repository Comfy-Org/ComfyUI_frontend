<template>
  <div class="relative" @pointerdown.stop>
    <div
      v-if="!hideWhenEmpty || modelValue"
      class="relative flex h-16 w-full items-center gap-4 rounded-lg bg-input px-4 py-0"
    >
      <!-- Hidden audio element -->
      <audio
        ref="audioRef"
        :src="modelValue"
        @loadedmetadata="handleLoadedMetadata"
        @timeupdate="handleTimeUpdate"
        @ended="handleEnded"
        @pause="handlePause"
        @error="handleError"
      />

      <!-- Left Actions -->
      <div class="relative flex shrink-0 items-center gap-2">
        <!-- Play/Pause Button -->
        <Button
          variant="textonly"
          size="unset"
          :aria-label="$t('g.playPause')"
          :aria-pressed="isPlaying"
          class="size-6 rounded-sm"
          @click="togglePlayPause"
        >
          <i
            v-if="!isPlaying"
            class="icon-[lucide--play] text-muted-foreground"
          />
          <i v-else class="icon-[lucide--pause] text-muted-foreground" />
        </Button>

        <!-- Time Display -->
        <div class="text-sm font-normal text-nowrap text-foreground">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="relative h-0.5 flex-1 rounded-full bg-border">
        <div
          class="absolute top-0 left-0 h-full rounded-full bg-muted-foreground transition-all"
          :style="{ width: `${progressPercentage}%` }"
        />
        <input
          type="range"
          :value="progressPercentage"
          min="0"
          max="100"
          step="0.1"
          :aria-label="$t('g.audioProgress')"
          class="absolute inset-0 w-full cursor-pointer opacity-0"
          @input="handleSeek"
        />
      </div>

      <!-- Right Actions -->
      <div class="relative flex shrink-0 items-center gap-2">
        <!-- Volume Button -->
        <Button
          variant="textonly"
          size="unset"
          :aria-label="$t('g.volume')"
          class="size-6 rounded-sm"
          @click="toggleMute"
        >
          <i
            v-if="showVolumeTwo"
            class="icon-[lucide--volume-2] text-muted-foreground"
          />
          <i
            v-else-if="showVolumeOne"
            class="icon-[lucide--volume-1] text-muted-foreground"
          />
          <i v-else class="icon-[lucide--volume-x] text-muted-foreground" />
        </Button>

        <!-- Download Button -->
        <Button
          v-if="modelValue"
          size="icon-sm"
          variant="textonly"
          :aria-label="$t('g.downloadAudio')"
          :title="$t('g.downloadAudio')"
          class="size-6"
          @click="handleDownload"
        >
          <i class="icon-[lucide--download] text-muted-foreground" />
        </Button>

        <!-- Options Button -->
        <Menu v-if="showOptionsButton" :items="menuItems">
          <template #trigger>
            <Button
              variant="textonly"
              size="unset"
              :aria-label="$t('g.moreOptions')"
              class="size-6 rounded-sm"
            >
              <i class="icon-[lucide--more-vertical] text-muted-foreground" />
            </Button>
          </template>
          <template #item="{ item, hasSubmenu }">
            <div v-if="item.key === 'volume'" class="w-48">
              <label class="mb-2 block text-xs text-foreground">{{
                item.label
              }}</label>
              <Slider
                :model-value="[volume * 10]"
                :min="0"
                :max="10"
                :step="1"
                @update:model-value="handleVolumeChange"
              />
            </div>
            <MenuItemContent v-else :item :has-submenu />
          </template>
        </Menu>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useToast } from '@/components/ui/toast/toastStore'
import { createToastId } from '@/types/toastId'

import { downloadFile } from '@/base/common/downloadUtil'
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItemContent from '@comfyorg/design-system/menu/MenuItemContent'
import Slider from '@comfyorg/design-system/slider/Slider'

import { formatTime } from '@/utils/formatUtil'

const { t } = useI18n()
const toast = useToast()

const { hideWhenEmpty = true, showOptionsButton } = defineProps<{
  hideWhenEmpty?: boolean
  showOptionsButton?: boolean
}>()

// Refs
const audioRef = useTemplateRef('audioRef')
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)

// Computed
const progressPercentage = computed(() => {
  if (!duration.value || duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})
const modelValue = defineModel<string>()

const showVolumeTwo = computed(() => !isMuted.value && volume.value > 0.5)
const showVolumeOne = computed(() => !isMuted.value && volume.value > 0)

// Playback controls
let playAttempt = 0
const playbackErrorToastId = createToastId()

onUnmounted(() => {
  playAttempt++
  toast.dismiss(playbackErrorToastId)
})

const togglePlayPause = async () => {
  const audio = audioRef.value
  if (!audio || !audio.src) {
    return
  }

  const attempt = ++playAttempt
  if (isPlaying.value) {
    audio.pause()
    isPlaying.value = false
    toast.dismiss(playbackErrorToastId)
    return
  }

  isPlaying.value = true
  try {
    if (audio.error) audio.load()
    await audio.play()
    if (attempt === playAttempt) toast.dismiss(playbackErrorToastId)
  } catch (error) {
    if (attempt !== playAttempt) return
    isPlaying.value = false
    if (error instanceof DOMException && error.name === 'AbortError') {
      toast.dismiss(playbackErrorToastId)
      return
    }
    showPlaybackError(error)
  }
}

function showPlaybackError(error: unknown) {
  reportError(error, {
    errorType: 'error_playing_audio',
    surface: 'graph',
    level: 'warning'
  })
  toast.error(t('g.error'), {
    id: playbackErrorToastId,
    description: t('g.audioPlaybackFailed')
  })
}

const handleDownload = () => {
  if (!modelValue.value) return
  try {
    downloadFile(modelValue.value)
  } catch {
    toast.error(t('g.error'), { description: t('g.failedToDownloadFile') })
  }
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
  }
}

const handleTimeUpdate = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const handlePause = () => {
  if (audioRef.value?.paused) isPlaying.value = false
}

const handleError = () => {
  if (!isPlaying.value) return
  isPlaying.value = false
  showPlaybackError(audioRef.value?.error)
}

const handleEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

const setPlaybackSpeed = (speed: number) => {
  playbackRate.value = speed
  if (audioRef.value) {
    audioRef.value.playbackRate = speed
  }
}

const handleVolumeChange = (value: number[] | undefined) => {
  const numValue = value?.[0] ?? 0
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
    radioGroup: {
      value: () => String(playbackRate.value),
      options: [
        {
          value: '0.5',
          label: t('g.halfSpeed'),
          command: () => setPlaybackSpeed(0.5)
        },
        {
          value: '1',
          label: t('g.1x'),
          command: () => setPlaybackSpeed(1)
        },
        {
          value: '2',
          label: t('g.2x'),
          command: () => setPlaybackSpeed(2)
        }
      ]
    }
  },
  {
    label: t('g.volume'),
    key: 'volume'
  }
])

watch(modelValue, (value) => {
  playAttempt++
  isPlaying.value = false
  toast.dismiss(playbackErrorToastId)
  audioRef.value?.pause()
  if (value) {
    audioRef.value?.load()
    return
  }
  currentTime.value = 0
  duration.value = 0
})
</script>
