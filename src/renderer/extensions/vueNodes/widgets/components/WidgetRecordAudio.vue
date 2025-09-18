<template>
  <div class="bg-[#262729] rounded-lg px-4 h-14 flex items-center gap-4">
    <!-- Recording Status -->
    <div class="flex gap-2 items-center shrink-0 text-white">
      <span class="text-xs">
        {{
          isRecording
            ? t('g.listening') || 'Listening...'
            : isPlaying
              ? 'Playing...'
              : recordedURL
                ? 'Ready'
                : 'Press record'
        }}
      </span>
      <span class="text-sm">{{ formatTime(timer) }}</span>
    </div>

    <!-- Waveform Visualization -->
    <div class="flex-1 flex gap-2 items-center h-8 overflow-hidden">
      <div
        v-for="i in 30"
        :key="i"
        class="w-[3px] bg-[#9c9eab] rounded-[1.5px] transition-all duration-100"
        :style="{ height: `${waveformHeights[i - 1] || 16}px` }"
      />
    </div>

    <!-- Control Button -->
    <button
      v-if="!isRecording && !recordedURL"
      :title="t('g.startRecording') || 'Start Recording'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
      @click="startRecording"
    >
      <div class="size-3 bg-[#FF4444] rounded-full" />
    </button>

    <button
      v-else-if="isRecording"
      :title="t('g.stopRecording') || 'Stop Recording'"
      class="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors animate-pulse"
      @click="stopRecording"
    >
      <div class="size-2.5 bg-[#C02323] rounded-sm" />
    </button>

    <button
      v-else-if="recordedURL && !isPlaying"
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

  <!-- Additional Controls (optional, shown when recording exists) -->
  <div v-if="showControls && recordedURL" class="mt-2 flex gap-2 justify-end">
    <button
      class="bg-[#3a3b3d] hover:bg-[#4a4b4d] text-white rounded px-3 py-1 text-xs transition-colors"
      @click="downloadRecording"
    >
      {{ t('g.download') || 'Download' }}
    </button>
    <button
      class="bg-[#3a3b3d] hover:bg-[#4a4b4d] text-white rounded px-3 py-1 text-xs transition-colors"
      @click="clearRecording"
    >
      {{ t('g.clear') || 'Clear' }}
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
import { onUnmounted, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAudioService } from '@/services/audioService'

const props = defineProps<{
  widget?: any
  nodeData?: any
  showControls?: boolean
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
    audioChunks.value = []
    recordedURL.value = null
    timer.value = 0

    await useAudioService().registerWavEncoder()

    stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Setup audio context for visualization
    audioContext.value = new (window.AudioContext ||
      (window as any).webkitAudioContext)()
    analyser.value = audioContext.value.createAnalyser()
    const source = audioContext.value.createMediaStreamSource(stream.value)
    source.connect(analyser.value)

    analyser.value.fftSize = 256
    dataArray.value = new Uint8Array(analyser.value.frequencyBinCount)

    // Create recorder
    mediaRecorder.value = new ExtendableMediaRecorder(stream.value, {
      mimeType: 'audio/wav'
    }) as unknown as MediaRecorder

    mediaRecorder.value.ondataavailable = (e) => {
      audioChunks.value.push(e.data)
    }

    mediaRecorder.value.onstop = async () => {
      const blob = new Blob(audioChunks.value, { type: 'audio/wav' })
      recordedURL.value = URL.createObjectURL(blob)

      // Upload to server
      const path = await useAudioService().convertBlobToFileAndSubmit(blob)
      modelValue.value = path

      // Update audio widget if exists
      if (props.nodeData?.widgets) {
        const audioWidget = props.nodeData.widgets.find(
          (w: any) => w.name === 'audio'
        )
        if (audioWidget) audioWidget.value = path
      }

      cleanup()
    }

    mediaRecorder.value.start()
    isRecording.value = true

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
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }
  cleanup()
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

// Download recording
function downloadRecording() {
  if (!recordedURL.value) return

  const a = document.createElement('a')
  a.href = recordedURL.value
  a.download = `recording_${Date.now()}.wav`
  a.click()
}

// Clear recording
function clearRecording() {
  if (recordedURL.value) {
    URL.revokeObjectURL(recordedURL.value)
    recordedURL.value = null
  }
  timer.value = 0
  modelValue.value = null
}

// Initialize on mount
initWaveform()

// Cleanup on unmount
onUnmounted(() => {
  stopRecording()
  stopPlayback()
  if (recordedURL.value) {
    URL.revokeObjectURL(recordedURL.value)
  }
})
</script>
