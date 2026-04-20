<template>
  <div class="relative" @pointerdown.stop>
    <div
      v-if="!hideWhenEmpty || modelValue"
      class="relative box-border flex h-16 w-full items-center justify-start gap-4 rounded-lg bg-component-node-widget-background px-4 py-0"
    >
      <!-- Hidden audio element -->
      <audio
        ref="audioRef"
        :src="modelValue"
        @loadedmetadata="handleLoadedMetadata"
        @timeupdate="handleTimeUpdate"
        @ended="handleEnded"
      />

      <!-- Left Actions -->
      <div class="relative flex shrink-0 items-center justify-start gap-2">
        <!-- Play/Pause Button -->
        <Button
          variant="textonly"
          size="unset"
          :aria-label="$t('g.playPause')"
          class="size-6 rounded-sm"
          @click="togglePlayPause"
        >
          <i
            v-if="!isPlaying"
            class="text-secondary icon-[lucide--play] size-4"
          />
          <i v-else class="text-secondary icon-[lucide--pause] size-4" />
        </Button>

        <!-- Time Display -->
        <div class="text-sm font-normal text-nowrap text-base-foreground">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="relative h-0.5 flex-1 rounded-full bg-interface-stroke">
        <div
          class="absolute top-0 left-0 h-full rounded-full bg-button-icon transition-all"
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
      <div class="relative flex shrink-0 items-center justify-start gap-2">
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
            class="text-secondary icon-[lucide--volume-2] size-4"
          />
          <i
            v-else-if="showVolumeOne"
            class="text-secondary icon-[lucide--volume-1] size-4"
          />
          <i v-else class="text-secondary icon-[lucide--volume-x] size-4" />
        </Button>

        <!-- Download Button -->
        <Button
          v-if="modelValue"
          size="icon-sm"
          variant="textonly"
          :aria-label="$t('g.downloadAudio')"
          :title="$t('g.downloadAudio')"
          :disabled="downloading"
          class="size-6 hover:bg-interface-menu-component-surface-hovered"
          @click="handleDownload"
        >
          <i
            :class="
              downloading
                ? 'text-secondary icon-[lucide--loader-circle] size-4 animate-spin'
                : 'text-secondary icon-[lucide--download] size-4'
            "
          />
        </Button>

        <!-- Options Button -->
        <Button
          v-if="showOptionsButton"
          variant="textonly"
          size="unset"
          :aria-label="$t('g.moreOptions')"
          class="size-6 rounded-sm"
          @click="toggleOptionsMenu"
        >
          <i class="text-secondary icon-[lucide--more-vertical] size-4" />
        </Button>
      </div>

      <!-- Options Menu -->
      <TieredMenu
        ref="optionsMenu"
        :model="menuItems"
        popup
        class="audio-player-menu"
        :pt:root:class="
          cn('border-component-node-border bg-component-node-widget-background')
        "
        :pt:submenu:class="cn('bg-component-node-widget-background')"
      >
        <template #item="{ item }">
          <div v-if="item.key === 'volume'" class="w-48 px-4 py-2">
            <label class="mb-2 block text-xs text-base-foreground">{{
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
            class="flex cursor-pointer items-center px-4 py-2 text-xs hover:bg-white/10"
            @click="item.onClick?.()"
          >
            <span class="text-base-foreground">{{ item.label }}</span>
            <i
              v-if="item.selected"
              class="ml-auto icon-[lucide--check] size-4 text-base-foreground"
            />
          </div>
        </template>
      </TieredMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import TieredMenu from 'primevue/tieredmenu'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { whenever } from '@vueuse/core'

import { useToast } from 'primevue/usetoast'

import Button from '@/components/ui/button/Button.vue'
import { useDownloadFile } from '@/base/common/useDownloadFile'
import { cn } from '@/utils/tailwindUtil'

import { formatTime } from '@/utils/formatUtil'

const { t } = useI18n()
const toast = useToast()
const {
  isLoading: downloading,
  error: downloadError,
  execute: download
} = useDownloadFile()

watch(downloadError, (err) => {
  if (err) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('g.failedToDownloadFile')
    })
  }
})

const { hideWhenEmpty = true, showOptionsButton } = defineProps<{
  hideWhenEmpty?: boolean
  showOptionsButton?: boolean
}>()

// Refs
const audioRef = useTemplateRef('audioRef')
const optionsMenu = ref()
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
const showVolumeOne = computed(() => isMuted.value && volume.value > 0)

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

const handleDownload = () => {
  if (!modelValue.value) return
  void download(modelValue.value)
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

whenever(
  modelValue,
  () => {
    isPlaying.value = false
    audioRef.value?.pause()
    void audioRef.value?.load()
  },
  { immediate: true }
)
</script>

<style scoped>
.audio-player-menu {
  --p-tieredmenu-item-focus-background: rgb(255 255 255 / 0.1);
  --p-tieredmenu-item-active-background: rgb(255 255 255 / 0.1);
}
</style>
