<template>
  <div class="mb-4">
    <Button
      class="bg-[#2D2E32] text-white border-0 w-[413px]"
      :disabled="isRecording || readonly"
      @click="handleStartRecording"
    >
      {{ t('g.startRecording', 'Start Recording') }}
      <i-lucide:mic class="ml-1" />
    </Button>
  </div>
  <div
    v-if="isRecording || isPlaying || recordedURL"
    class="bg-[#262729] rounded-lg px-4 h-14 flex items-center gap-4 w-[413px]"
  >
    <!-- Recording Status -->
    <div class="flex gap-2 items-center text-white min-w-[120px]">
      <span class="text-xs min-w-[80px]">
        {{
          isRecording
            ? t('g.listening', 'Listening...')
            : isPlaying
              ? t('g.playing', 'Playing...')
              : recordedURL
                ? t('g.ready', 'Ready')
                : ''
        }}
      </span>
      <span class="text-sm min-w-[40px]">{{ formatTime(timer) }}</span>
    </div>

    <!-- Waveform Visualization -->
    <div class="flex-1 flex gap-2 items-center h-8 overflow-x-clip">
      <div
        v-for="(bar, index) in waveformBars"
        :key="index"
        class="w-[3px] bg-[#9c9eab] rounded-[1.5px] transition-all duration-100 min-h-[4px] max-h-[32px]"
        :style="{ height: bar.height + 'px' }"
        :title="`Bar ${index + 1}: ${bar.height}px`"
      />
    </div>

    <!-- Control Button -->
    <button
      v-if="isRecording"
      :title="t('g.stopRecording', 'Stop Recording')"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors animate-pulse"
      @click="handleStopRecording"
    >
      <div class="size-2.5 bg-[#C02323] rounded-sm" />
    </button>

    <button
      v-else-if="!isRecording && recordedURL && !isPlaying"
      :title="t('g.playRecording') || 'Play Recording'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
      @click="handlePlayRecording"
    >
      <i class="icon-[lucide--play] size-4 text-[#00D2D3]" />
    </button>

    <button
      v-else-if="isPlaying"
      :title="t('g.stopPlayback') || 'Stop Playback'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
      @click="handleStopPlayback"
    >
      <i class="icon-[lucide--square] size-4 text-[#00D2D3]" />
    </button>
  </div>
  <audio
    v-if="recordedURL"
    ref="audioRef"
    :key="audioElementKey"
    :src="recordedURL"
    class="hidden"
    @ended="playback.onPlaybackEnded"
    @loadedmetadata="playback.onMetadataLoaded"
  />
</template>

<script setup lang="ts">
import { Button } from 'primevue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAudioService } from '@/services/audioService'

import { useAudioPlayback } from '../composables/audio/useAudioPlayback'
import { useAudioRecorder } from '../composables/audio/useAudioRecorder'
import { useAudioWaveform } from '../composables/audio/useAudioWaveform'
import { useTimer } from '../composables/audio/useTimer'
import { formatTime } from '../utils/audioUtils'

const props = defineProps<{
  widget?: any
  nodeData?: any
  readonly?: boolean
  node?: any
}>()

const modelValue = defineModel<any>('modelValue')

// Audio element ref
const audioRef = ref<HTMLAudioElement>()

// Keep track of the last uploaded path as a backup
let lastUploadedPath = ''

// Composables
const recorder = useAudioRecorder({
  onRecordingComplete: handleRecordingComplete,
  onError: () => {
    useToastStore().addAlert(
      t('g.micPermissionDenied') || 'Microphone permission denied'
    )
  }
})

const waveform = useAudioWaveform({
  barCount: 18,
  minHeight: 4,
  maxHeight: 32
})

const playback = useAudioPlayback(audioRef, {
  onPlaybackEnded: handlePlaybackEnded,
  onMetadataLoaded: (duration) => {
    if (!isPlaying.value && !isRecording.value) {
      timerControl.setTime(Math.floor(duration))
    }
  }
})

const timerControl = useTimer()

// Destructure for template access
const { isRecording, recordedURL } = recorder
const { waveformBars } = waveform
const { isPlaying, audioElementKey } = playback
const { timer } = timerControl

// Computed for waveform animation
const isWaveformActive = computed(() => isRecording.value || isPlaying.value)

async function handleRecordingComplete(blob: Blob) {
  try {
    const path = await useAudioService().convertBlobToFileAndSubmit(blob)
    modelValue.value = path
    lastUploadedPath = path
  } catch (e) {
    useToastStore().addAlert('Failed to upload recorded audio')
  }
}

async function handleStartRecording() {
  if (props.readonly) return

  try {
    await waveform.setupAudioContext()
    await recorder.startRecording()

    // Setup waveform visualization for recording
    if (recorder.mediaRecorder.value) {
      const stream = (recorder.mediaRecorder.value as any).stream
      if (stream) {
        await waveform.setupRecordingVisualization(stream)
      }
    }

    timerControl.start(1000)
    waveform.initWaveform()
    waveform.updateWaveform(isWaveformActive)
  } catch (err) {
    // Error already handled by recorder
  }
}

function handleStopRecording() {
  recorder.stopRecording()
  timerControl.stop()
  waveform.stopWaveform()
}

async function handlePlayRecording() {
  if (!recordedURL.value) return

  timerControl.reset()

  // Reset and setup audio element
  await playback.resetAudioElement()

  // Wait for audio element to be ready
  await new Promise((resolve) => setTimeout(resolve, 50))

  if (!audioRef.value) return

  // Setup waveform visualization for playback
  const setupSuccess = await waveform.setupPlaybackVisualization(audioRef.value)
  if (!setupSuccess) return

  // Start playback
  await playback.play()

  // Start timer
  timerControl.start(100)

  // Update waveform
  waveform.initWaveform()
  waveform.updateWaveform(isWaveformActive)

  // Update timer from audio current time
  const timerInterval = setInterval(() => {
    timerControl.setTime(Math.floor(playback.getCurrentTime()))
  }, 100)

  // Store interval for cleanup
  ;(playback as any)._playbackTimerInterval = timerInterval
}

function handleStopPlayback() {
  playback.stop()
  handlePlaybackEnded()
}

function handlePlaybackEnded() {
  timerControl.stop()
  waveform.stopWaveform()

  // Clear playback timer interval
  if ((playback as any)._playbackTimerInterval) {
    clearInterval((playback as any)._playbackTimerInterval)
    ;(playback as any)._playbackTimerInterval = null
  }

  const duration = playback.getDuration()
  if (duration) {
    timerControl.setTime(Math.floor(duration))
  } else {
    timerControl.reset()
  }
}

// Serialization function for workflow execution
async function serializeValue() {
  if (isRecording.value && recorder.mediaRecorder.value) {
    recorder.mediaRecorder.value.stop()

    await new Promise((resolve) => {
      const checkRecording = () => {
        if (!isRecording.value && modelValue.value) {
          resolve(undefined)
        } else {
          setTimeout(checkRecording, 100)
        }
      }
      checkRecording()
    })
  }

  return modelValue.value || lastUploadedPath || ''
}

onMounted(() => {
  waveform.initWaveform()
})

onUnmounted(() => {
  recorder.dispose()
  waveform.dispose()
  if ((playback as any)._playbackTimerInterval) {
    clearInterval((playback as any)._playbackTimerInterval)
  }
})

defineExpose({ serializeValue })
</script>
