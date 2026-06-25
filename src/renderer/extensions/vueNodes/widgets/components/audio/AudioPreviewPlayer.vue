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
          class="size-6 hover:bg-interface-menu-component-surface-hovered"
          @click="handleDownload"
        >
          <i class="text-secondary icon-[lucide--download] size-4" />
        </Button>

        <!-- Options Menu -->
        <DropdownMenu v-if="showOptionsButton" :modal="false">
          <DropdownMenuTrigger as-child>
            <Button
              variant="textonly"
              size="unset"
              :aria-label="$t('g.moreOptions')"
              class="size-6 rounded-sm"
            >
              <i class="text-secondary icon-[lucide--more-vertical] size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent size="lg" align="end" :side-offset="4">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {{ $t('g.playbackSpeed') }}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  v-for="speed in playbackSpeedOptions"
                  :key="speed.value"
                  checkable
                  :checked="playbackRate === speed.value"
                  @select="setPlaybackSpeed(speed.value)"
                >
                  {{ speed.label }}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <div class="w-48 px-2 py-1.5" @pointerdown.stop @keydown.stop>
              <label class="mb-2 block text-xs text-base-foreground">{{
                $t('g.volume')
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { whenever } from '@vueuse/core'

import { useToast } from 'primevue/usetoast'

import { downloadFile } from '@/base/common/downloadUtil'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuSub from '@/components/ui/dropdown-menu/DropdownMenuSub.vue'
import DropdownMenuSubContent from '@/components/ui/dropdown-menu/DropdownMenuSubContent.vue'
import DropdownMenuSubTrigger from '@/components/ui/dropdown-menu/DropdownMenuSubTrigger.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'

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
  try {
    downloadFile(modelValue.value)
  } catch {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('g.failedToDownloadFile')
    })
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

const playbackSpeedOptions = computed(() => [
  { label: t('g.halfSpeed'), value: 0.5 },
  { label: t('g.1x'), value: 1 },
  { label: t('g.2x'), value: 2 }
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
