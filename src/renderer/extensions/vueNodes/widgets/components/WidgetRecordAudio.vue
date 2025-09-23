<template>
  <div class="mb-4">
    <Button
      class="w-full bg-[#2D2E32] text-white border-0"
      :disabled="isRecording || readonly"
      @click="startRecording"
    >
      {{ t('g.startRecording', 'Start Recording') }}
      <i-lucide:mic class="ml-1" />
    </Button>
  </div>
  <div
    v-if="isRecording || isPlaying || recordedURL"
    class="bg-[#262729] rounded-lg px-4 h-14 flex items-center gap-4"
  >
    <!-- Recording Status -->
    <div class="flex gap-2 items-center shrink-0 text-white">
      <span class="text-xs">
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
      <span class="text-sm">{{ formatTime(timer) }}</span>
    </div>

    <!-- Waveform Visualization -->
    <div
      v-if="isRecording || isPlaying"
      class="flex-1 flex gap-2 items-center h-8 overflow-hidden"
    >
      <div
        v-for="i in 30"
        :key="i"
        class="w-[3px] bg-[#9c9eab] rounded-[1.5px] transition-all duration-100"
        :style="{ height: `${waveformHeights[i - 1] || 16}px` }"
      />
    </div>

    <!-- Control Button -->
    <button
      v-if="isRecording"
      :title="t('g.stopRecording') || 'Stop Recording'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors animate-pulse"
      @click="stopRecording"
    >
      <div class="size-2.5 bg-[#C02323] rounded-sm" />
    </button>

    <button
      v-else-if="!isRecording && recordedURL && !isPlaying"
      :title="t('g.playRecording') || 'Play Recording'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
      @click="playRecording"
    >
      <i class="icon-[lucide--play] size-4 text-[#00D2D3]" />
    </button>

    <button
      v-else-if="isPlaying"
      :title="t('g.stopPlayback') || 'Stop Playback'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
      @click="stopPlayback"
    >
      <i class="icon-[lucide--pause] size-4 text-[#00D2D3]" />
    </button>
  </div>
  <!-- Hidden audio element -->
  <audio
    v-if="recordedURL"
    ref="audioRef"
    :src="recordedURL"
    class="hidden"
    @ended="onPlaybackEnded"
  />
</template>

<script setup lang="ts">
import { MediaRecorder as ExtendableMediaRecorder } from 'extendable-media-recorder'
import { Button } from 'primevue'
import { onMounted, onUnmounted, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAudioService } from '@/services/audioService'

const props = defineProps<{
  widget?: any
  nodeData?: any
  readonly?: boolean
}>()

const modelValue = defineModel<any>('modelValue')

// State
const isRecording = ref(false)
const isPlaying = ref(false)
const timer = ref(0)
const recordedURL = ref<string | null>(null)
const waveformHeights = ref<number[]>(Array(30).fill(16))

// Recording
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
const stream = ref<MediaStream | null>(null)
const timerInterval = ref<number | null>(null)

// Audio visualization
const audioContext = ref<AudioContext | null>(null)
const analyser = ref<AnalyserNode | null>(null)
const dataArray = ref<Uint8Array | null>(null)
const animationId = ref<number | null>(null)

// Audio element
const audioRef = ref<HTMLAudioElement>()

// Format time
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Initialize waveform
const initWaveform = () => {
  for (let i = 0; i < 30; i++) {
    waveformHeights.value[i] = Math.random() * 28 + 4
  }
}

// Update waveform visualization
const updateWaveform = () => {
  if (!isRecording.value && !isPlaying.value) return

  if (analyser.value && dataArray.value) {
    analyser.value.getByteFrequencyData(dataArray.value as any)

    // Update heights based on frequency data
    const bars = []
    for (let i = 0; i < 30; i++) {
      const samplesPerBar = Math.floor(dataArray.value.length / 30)
      let sum = 0
      for (let j = 0; j < samplesPerBar; j++) {
        sum += dataArray.value[i * samplesPerBar + j] || 0
      }
      bars.push((sum / samplesPerBar / 255) * 28 + 4)
    }
    waveformHeights.value = bars
  } else {
    // Animate randomly when no data
    waveformHeights.value = waveformHeights.value.map((h) =>
      Math.max(4, Math.min(32, h + (Math.random() - 0.5) * 4))
    )
  }

  animationId.value = requestAnimationFrame(updateWaveform)
}

// Start recording
async function startRecording() {
  try {
    if (props.readonly) {
      console.log('[WidgetRecordAudio] Recording blocked - readonly mode')
      return
    }

    console.log('[WidgetRecordAudio] Starting recording...')
    audioChunks.value = []
    recordedURL.value = null
    timer.value = 0

    await useAudioService().registerWavEncoder()
    console.log('[WidgetRecordAudio] WAV encoder registered')

    stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
    console.log('[WidgetRecordAudio] Microphone access granted')

    // Setup audio context for visualization
    audioContext.value = new (window.AudioContext ||
      (window as any).webkitAudioContext)()
    analyser.value = audioContext.value.createAnalyser()
    const source = audioContext.value.createMediaStreamSource(stream.value)
    source.connect(analyser.value)

    analyser.value.fftSize = 256
    dataArray.value = new Uint8Array(analyser.value.frequencyBinCount)
    console.log('[WidgetRecordAudio] Audio context and analyser setup complete')

    // Create recorder
    mediaRecorder.value = new ExtendableMediaRecorder(stream.value, {
      mimeType: 'audio/wav'
    }) as unknown as MediaRecorder
    console.log('[WidgetRecordAudio] MediaRecorder created')

    mediaRecorder.value.ondataavailable = (e) => {
      audioChunks.value.push(e.data)
    }

    mediaRecorder.value.onstop = async () => {
      console.log('[WidgetRecordAudio] Recording stopped, processing...')

      const blob = new Blob(audioChunks.value, { type: 'audio/wav' })
      console.log('[WidgetRecordAudio] Audio blob created:', {
        size: blob.size,
        type: blob.type,
        chunks: audioChunks.value.length
      })

      if (recordedURL.value?.startsWith('blob:')) {
        URL.revokeObjectURL(recordedURL.value)
      }
      recordedURL.value = URL.createObjectURL(blob)
      console.log('[WidgetRecordAudio] Blob URL created:', recordedURL.value)

      // Immediately upload and update widget values so execution has a valid path
      try {
        const path = await useAudioService().convertBlobToFileAndSubmit(blob)
        modelValue.value = path
        console.log('[WidgetRecordAudio] Uploaded and set modelValue:', path)

        if (props.nodeData?.widgets) {
          const audioWidget = props.nodeData.widgets.find(
            (w: any) => w.name === 'audio'
          )
          if (audioWidget) {
            if (
              audioWidget.options?.values &&
              !audioWidget.options.values.includes(path)
            ) {
              audioWidget.options.values.push(path)
            }
            audioWidget.value = path
            console.log('[WidgetRecordAudio] Audio widget updated:', path)
          }
        }
      } catch (e) {
        console.error('[WidgetRecordAudio] Upload failed:', e)
        useToastStore().addAlert('Failed to upload recorded audio')
      }

      console.log('[WidgetRecordAudio] Recording process complete')
      cleanup()
    }

    mediaRecorder.value.start()
    isRecording.value = true
    console.log('[WidgetRecordAudio] Recording started')

    // Start timer
    timerInterval.value = window.setInterval(() => {
      timer.value += 1
    }, 1000)

    updateWaveform()
  } catch (err) {
    console.error('Error accessing microphone:', err)
    useToastStore().addAlert(
      t('g.micPermissionDenied') || 'Microphone permission denied'
    )
  }
}

// Stop recording
function stopRecording() {
  console.log('[WidgetRecordAudio] Stop recording requested')
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    console.log('[WidgetRecordAudio] Stopping MediaRecorder...')
    mediaRecorder.value.stop()
  } else {
    console.log('[WidgetRecordAudio] MediaRecorder already inactive or null')
    cleanup()
  }
}

// Cleanup recording resources
function cleanup() {
  isRecording.value = false

  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop())
    stream.value = null
  }

  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }

  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }

  if (audioContext.value) {
    void audioContext.value.close()
    audioContext.value = null
  }
}

// Play recording
async function playRecording() {
  if (!audioRef.value || !recordedURL.value) return

  timer.value = 0
  isPlaying.value = true

  // Setup visualization
  audioContext.value = new (window.AudioContext ||
    (window as any).webkitAudioContext)()
  analyser.value = audioContext.value.createAnalyser()
  const source = audioContext.value.createMediaElementSource(audioRef.value)
  source.connect(analyser.value)
  analyser.value.connect(audioContext.value.destination)

  analyser.value.fftSize = 256
  dataArray.value = new Uint8Array(analyser.value.frequencyBinCount)

  // Start timer
  timerInterval.value = window.setInterval(() => {
    timer.value = Math.floor(audioRef.value?.currentTime || 0)
  }, 100)

  audioRef.value.play().catch((error) => {
    console.error('Error playing audio:', error)
  })
  updateWaveform()
}

// Stop playback
function stopPlayback() {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.currentTime = 0
  }
  void onPlaybackEnded()
}

// Playback ended
async function onPlaybackEnded() {
  isPlaying.value = false
  timer.value = 0

  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }

  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }

  if (audioContext.value) {
    await audioContext.value.close()
    audioContext.value = null
  }
}

// Initialize on mount
onMounted(() => {
  console.log('[WidgetRecordAudio] Mounted:', {
    nodeClass:
      props.nodeData?.constructor?.comfyClass ||
      props.nodeData?.type ||
      'Unknown',
    nodeTitle: props.nodeData?.title,
    hasNodeData: !!props.nodeData,
    readonly: props.readonly,
    modelValue: modelValue.value,
    availableWidgets:
      props.nodeData?.widgets?.map((w: any) => ({
        name: w.name,
        type: w.type
      })) || []
  })

  initWaveform()
})

// Cleanup on unmount
onUnmounted(() => {
  stopRecording()
  stopPlayback()
  if (recordedURL.value) {
    URL.revokeObjectURL(recordedURL.value)
  }
})

async function serializeValue() {
  console.log('[WidgetRecordAudio] serializeValue called:', {
    isRecording: isRecording.value,
    hasRecordedURL: !!recordedURL.value,
    modelValue: modelValue.value
  })

  // If still recording, stop and wait for completion
  if (isRecording.value && mediaRecorder.value) {
    console.log('[WidgetRecordAudio] Still recording, stopping first...')
    mediaRecorder.value.stop()

    // Wait for recording to complete
    await new Promise((resolve) => {
      const checkRecording = () => {
        if (!isRecording.value) {
          console.log(
            '[WidgetRecordAudio] Recording stopped, continuing serialization'
          )
          resolve(undefined)
        } else {
          setTimeout(checkRecording, 100)
        }
      }
      checkRecording()
    })
  }

  // If we have a recorded audio blob but no uploaded path yet, upload now
  if (recordedURL.value && !modelValue.value) {
    console.log(
      '[WidgetRecordAudio] Have recorded audio, uploading during serialization...'
    )
    try {
      const blob = await fetch(recordedURL.value).then((r) => r.blob())
      const path = await useAudioService().convertBlobToFileAndSubmit(blob)
      modelValue.value = path
      console.log(
        '[WidgetRecordAudio] Upload during serialization successful:',
        path
      )

      // Update audio widget
      if (props.nodeData?.widgets) {
        const audioWidget = props.nodeData.widgets.find(
          (w: any) => w.name === 'audio'
        )
        if (audioWidget) {
          audioWidget.value = path
          console.log(
            '[WidgetRecordAudio] Audio widget updated during serialization:',
            path
          )
        }
      }
    } catch (error) {
      console.error(
        '[WidgetRecordAudio] Upload during serialization failed:',
        error
      )
      useToastStore().addAlert('Failed to upload recorded audio')
      return ''
    }
  }

  const finalValue = modelValue.value || ''
  console.log('[WidgetRecordAudio] serializeValue returning:', finalValue)
  return finalValue
}

defineExpose({ serializeValue })
</script>
