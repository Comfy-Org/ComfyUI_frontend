<template>
  <div class="">
    <div class="mb-4">
      <Button
        class="bg-zinc-500/10 dark-theme:bg-node-component-surface text-zinc-400 dark-theme:text-white border-0 w-[413px]"
        :disabled="isRecording || readonly"
        @click="handleStartRecording"
      >
        {{ t('g.startRecording', 'Start Recording') }}
        <i-lucide:mic class="ml-1" />
      </Button>
    </div>
    <div
      v-if="isRecording || isPlaying || recordedURL"
      class="bg-zinc-500/10 dark-theme:bg-node-component-surface rounded-lg px-4 text-zinc-400 dark-theme:text-white h-14 flex items-center gap-4 w-[413px]"
    >
      <!-- Recording Status -->
      <div class="flex gap-2 items-center min-w-30">
        <span class="text-xs min-w-20">
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
        <span class="text-sm min-w-10">{{ formatTime(timer) }}</span>
      </div>

      <!-- Waveform Visualization -->
      <div class="flex-1 flex gap-2 items-center h-8 overflow-x-clip">
        <div
          v-for="(bar, index) in waveformBars"
          :key="index"
          class="w-0.75 bg-slate-100 rounded-[1.5px] transition-all duration-100 min-h-1 max-h-8"
          :style="{ height: bar.height + 'px' }"
          :title="`Bar ${index + 1}: ${bar.height}px`"
        />
      </div>

      <!-- Control Button -->
      <button
        v-if="isRecording"
        :title="t('g.stopRecording', 'Stop Recording')"
        class="size-8 rounded-full bg-gray-500/33 flex items-center justify-center transition-colors animate-pulse border-0"
        @click="handleStopRecording"
      >
        <div class="size-2.5 bg-[#C02323] rounded-sm" />
      </button>

      <button
        v-else-if="!isRecording && recordedURL && !isPlaying"
        :title="t('g.playRecording') || 'Play Recording'"
        class="size-8 rounded-full bg-gray-500/33 flex items-center justify-center transition-colors border-0"
        @click="handlePlayRecording"
      >
        <i
          class="icon-[lucide--play] size-4 text-zinc-400 dark-theme:text-white"
        />
      </button>

      <button
        v-else-if="isPlaying"
        :title="t('g.stopPlayback') || 'Stop Playback'"
        class="size-8 rounded-full bg-gray-500/33 flex items-center justify-center transition-colors border-0"
        @click="handleStopPlayback"
      >
        <i
          class="icon-[lucide--square] size-4 text-zinc-400 dark-theme:text-white"
        />
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
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Button } from 'primevue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { useAudioService } from '@/services/audioService'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { useAudioPlayback } from '../composables/audio/useAudioPlayback'
import { useAudioRecorder } from '../composables/audio/useAudioRecorder'
import { useAudioWaveform } from '../composables/audio/useAudioWaveform'
import { formatTime } from '../utils/audioUtils'

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  modelValue: string
  nodeId: string
}>()

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
      timer.value = Math.floor(duration)
    }
  }
})

// Timer for recording
const timer = ref(0)
const { pause: pauseTimer, resume: resumeTimer } = useIntervalFn(
  () => {
    timer.value += 1
  },
  1000,
  { immediate: false }
)

// Destructure for template access
const { isRecording, recordedURL } = recorder
const { waveformBars } = waveform
const { isPlaying, audioElementKey } = playback

// Computed for waveform animation
const isWaveformActive = computed(() => isRecording.value || isPlaying.value)
const { localValue, onChange } = useStringWidgetValue(
  props.widget as SimplifiedWidget<string, Record<string, string>>,
  props.modelValue,
  emit
)
const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

async function handleRecordingComplete(blob: Blob) {
  try {
    const path = await useAudioService().convertBlobToFileAndSubmit(blob)
    localValue.value = path
    lastUploadedPath = path
    onChange(path)
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
      const stream = recorder.mediaRecorder.value.stream
      if (stream) {
        await waveform.setupRecordingVisualization(stream)
      }
    }

    // Start timer
    timer.value = 0
    resumeTimer()
    waveform.initWaveform()
    waveform.updateWaveform(isWaveformActive)
  } catch (err) {
    console.error('Failed to start recording:', err)
  }
}

function handleStopRecording() {
  recorder.stopRecording()
  pauseTimer()
  waveform.stopWaveform()
}

async function handlePlayRecording() {
  if (!recordedURL.value) return

  // Reset timer
  timer.value = 0

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

  // Update waveform
  waveform.initWaveform()
  waveform.updateWaveform(isWaveformActive)

  // Update timer from audio current time
  const timerInterval = setInterval(() => {
    timer.value = Math.floor(playback.getCurrentTime())
  }, 100)

  // Store interval for cleanup
  playback.playbackTimerInterval.value = timerInterval
}

function handleStopPlayback() {
  playback.stop()
  handlePlaybackEnded()
}

function handlePlaybackEnded() {
  waveform.stopWaveform()

  // Clear playback timer interval
  if (playback.playbackTimerInterval.value !== null) {
    clearInterval(playback.playbackTimerInterval.value)
    playback.playbackTimerInterval.value = null
  }

  const duration = playback.getDuration()
  if (duration) {
    timer.value = Math.floor(duration)
  } else {
    timer.value = 0
  }
}

// Serialization function for workflow execution
async function serializeValue() {
  if (isRecording.value && recorder.mediaRecorder.value) {
    recorder.mediaRecorder.value.stop()

    await new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 50 // 5 seconds max (50 * 100ms)
      const checkRecording = () => {
        if (!isRecording.value && props.modelValue) {
          resolve(undefined)
        } else if (++attempts >= maxAttempts) {
          reject(new Error('Recording serialization timeout after 5 seconds'))
        } else {
          setTimeout(checkRecording, 100)
        }
      }
      checkRecording()
    })
  }

  return props.modelValue || lastUploadedPath || ''
}

function registerWidgetSerialization() {
  const node = litegraphNode.value
  if (!node?.widgets) return
  const targetWidget = node.widgets.find((w: IBaseWidget) => w.name === 'audio')
  if (targetWidget) {
    targetWidget.serializeValue = serializeValue
  }
}

onMounted(() => {
  waveform.initWaveform()
  registerWidgetSerialization()
})

onUnmounted(() => {
  if (playback.playbackTimerInterval.value !== null) {
    clearInterval(playback.playbackTimerInterval.value)
    playback.playbackTimerInterval.value = null
  }
})
</script>
