<template>
  <div class="relative">
    <div
      v-if="!hidden"
      :class="
        cn(
          'bg-zinc-500/10 dark-theme:bg-charcoal-600 box-border flex gap-4 items-center justify-start relative rounded-lg w-full h-16 px-4 py-0',
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
      <div class="relative flex shrink-0 items-center justify-start gap-2">
        <!-- Play/Pause Button -->
        <div
          role="button"
          :tabindex="0"
          aria-label="Play/Pause"
          class="flex size-6 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark-theme:hover:bg-white/10"
          @click="togglePlayPause"
        >
          <i
            v-if="!isPlaying"
            class="icon-[lucide--play] size-4 text-smoke-600 dark-theme:text-smoke-800"
          />
          <i
            v-else
            class="icon-[lucide--pause] size-4 text-smoke-600 dark-theme:text-smoke-800"
          />
        </div>

        <!-- Time Display -->
        <div class="text-sm font-normal text-nowrap text-base-foreground">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>

      <!-- Progress Bar -->
      <div
        class="relative h-0.5 flex-1 rounded-full bg-smoke-300 dark-theme:bg-ash-800"
      >
        <div
          class="absolute top-0 left-0 h-full rounded-full bg-smoke-600 transition-all dark-theme:bg-white/50"
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
        <div
          role="button"
          :tabindex="0"
          aria-label="Volume"
          class="flex size-6 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark-theme:hover:bg-white/10"
          @click="toggleMute"
        >
          <i
            v-if="showVolumeTwo"
            class="icon-[lucide--volume-2] size-4 text-smoke-600 dark-theme:text-smoke-800"
          />
          <i
            v-else-if="showVolumeOne"
            class="icon-[lucide--volume-1] size-4 text-smoke-600 dark-theme:text-smoke-800"
          />
          <i
            v-else
            class="icon-[lucide--volume-x] size-4 text-smoke-600 dark-theme:text-smoke-800"
          />
        </div>

        <!-- Options Button -->
        <div
          v-if="showOptionsButton"
          ref="optionsButtonRef"
          role="button"
          :tabindex="0"
          aria-label="More Options"
          class="flex size-6 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark-theme:hover:bg-white/10"
          @click="toggleOptionsMenu"
        >
          <i
            class="icon-[lucide--more-vertical] size-4 text-smoke-600 dark-theme:text-smoke-800"
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
    <LODFallback />
  </div>
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import TieredMenu from 'primevue/tieredmenu'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import LODFallback from '@/renderer/extensions/vueNodes/components/LODFallback.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { getLocatorIdFromNodeData } from '@/utils/graphTraversalUtil'
import { isOutputNode } from '@/utils/nodeFilterUtil'
import { cn } from '@/utils/tailwindUtil'

import { formatTime, getResourceURL } from '../../utils/audioUtils'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    readonly?: boolean
    hideWhenEmpty?: boolean
    showOptionsButton?: boolean
    modelValue?: string
    nodeId?: string
    audioUrl?: string
  }>(),
  {
    hideWhenEmpty: true
  }
)

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

const showVolumeTwo = computed(() => !isMuted.value && volume.value > 0.5)
const showVolumeOne = computed(() => isMuted.value && volume.value > 0)

const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

const hidden = computed(() => {
  if (!litegraphNode.value) return false
  // dont show if its a LoadAudio and we have nodeId
  const isLoadAudio =
    litegraphNode.value.constructor?.comfyClass === 'LoadAudio'
  return isLoadAudio && !!props.nodeId
})

// Check if this is an output node
const isOutputNodeRef = computed(() => {
  const node = litegraphNode.value
  return !!node && isOutputNode(node)
})

const nodeLocatorId = computed(() => {
  const node = litegraphNode.value
  if (!node) return null
  return getLocatorIdFromNodeData(node)
})

const nodeOutputStore = useNodeOutputStore()

// Computed audio URL from node output (for output nodes)
const audioUrlFromOutput = computed(() => {
  if (!isOutputNodeRef.value || !nodeLocatorId.value) return ''

  const nodeOutput = nodeOutputStore.nodeOutputs[nodeLocatorId.value]
  if (!nodeOutput?.audio || nodeOutput.audio.length === 0) return ''

  const audio = nodeOutput.audio[0]
  if (!audio.filename) return ''

  return api.apiURL(
    getResourceURL(
      audio.subfolder || '',
      audio.filename,
      audio.type || 'output'
    )
  )
})

// Combined audio URL (output takes precedence for output nodes)
const finalAudioUrl = computed(() => {
  return audioUrlFromOutput.value || props.audioUrl || ''
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

// Load audio from URL
const loadAudioFromUrl = (url: string) => {
  if (!audioRef.value) return
  isPlaying.value = false
  audioRef.value.pause()
  audioRef.value.src = url
  void audioRef.value.load()
  hasAudio.value = !!url
}

// Watch for finalAudioUrl changes
watch(
  finalAudioUrl,
  (newUrl) => {
    if (newUrl) {
      void nextTick(() => {
        loadAudioFromUrl(newUrl)
      })
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
})
</script>

<style scoped>
.audio-player-menu {
  --p-tieredmenu-item-focus-background: rgb(255 255 255 / 0.1);
  --p-tieredmenu-item-active-background: rgb(255 255 255 / 0.1);
}
</style>
