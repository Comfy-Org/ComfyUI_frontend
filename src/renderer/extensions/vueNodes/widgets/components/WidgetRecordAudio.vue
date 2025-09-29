<template>
  <div class="mb-4">
    <Button
      class="bg-[#2D2E32] text-white border-0 w-[413px]"
      :disabled="isRecording || readonly"
      @click="startRecording"
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
      <i class="icon-[lucide--square] size-4 text-[#00D2D3]" />
    </button>
  </div>
  <!-- Hidden audio element -->
  <audio
    v-if="recordedURL"
    ref="audioRef"
    :key="audioElementKey"
    :src="recordedURL"
    class="hidden"
    @ended="onPlaybackEnded"
    @loadedmetadata="onAudioMetadataLoaded"
  />
</template>

<script setup lang="ts">
import { MediaRecorder as ExtendableMediaRecorder } from 'extendable-media-recorder'
import { Button } from 'primevue'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { useAudioService } from '@/services/audioService'

const WAVEFORM_NUM_BARS = 18
const props = defineProps<{
  widget?: any
  nodeData?: any
  readonly?: boolean
  node?: any
}>()

const modelValue = defineModel<any>('modelValue')

// State
const isRecording = ref(false)
const isPlaying = ref(false)
const timer = ref(0)
const recordedURL = ref<string | null>(null)
const waveformBars = ref<Array<{ height: number }>>(
  Array(WAVEFORM_NUM_BARS)
    .fill(null)
    .map(() => ({ height: 16 }))
)

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
const mediaElementSource = ref<MediaElementAudioSourceNode | null>(null)

// Audio element
const audioRef = ref<HTMLAudioElement>()
const audioElementKey = ref(0)

// Keep track of the last uploaded path as a backup
let lastUploadedPath = ''

// Format time
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const initWaveform = () => {
  waveformBars.value = Array.from({ length: WAVEFORM_NUM_BARS }, () => ({
    height: Math.random() * 28 + 4
  }))
}

const updateWaveform = () => {
  if (!isRecording.value && !isPlaying.value) return

  if (analyser.value && dataArray.value) {
    updateWaveformFromAudio()
  } else {
    updateWaveformRandom()
  }

  animationId.value = requestAnimationFrame(updateWaveform)
}

const updateWaveformFromAudio = () => {
  if (!analyser.value || !dataArray.value) return

  analyser.value.getByteFrequencyData(dataArray.value as any)
  const barCount = waveformBars.value.length
  const samplesPerBar = Math.floor(dataArray.value.length / barCount)

  waveformBars.value = waveformBars.value.map((_, i) => {
    let sum = 0
    for (let j = 0; j < samplesPerBar; j++) {
      sum += dataArray.value![i * samplesPerBar + j] || 0
    }
    const average = sum / samplesPerBar
    const normalizedHeight = (average / 255) * 28 + 4
    return { height: normalizedHeight }
  })
}

const updateWaveformRandom = () => {
  waveformBars.value = waveformBars.value.map((bar) => ({
    height: Math.max(4, Math.min(32, bar.height + (Math.random() - 0.5) * 4))
  }))
}

const setupAudioContext = async () => {
  if (audioContext.value && audioContext.value.state !== 'closed') {
    await audioContext.value.close()
  }
  audioContext.value = null
  mediaElementSource.value = null
}

const setupRecordingAudio = async () => {
  await useAudioService().registerWavEncoder()
  stream.value = await navigator.mediaDevices.getUserMedia({ audio: true })

  audioContext.value = new (window.AudioContext ||
    (window as any).webkitAudioContext)()
  analyser.value = audioContext.value.createAnalyser()
  const source = audioContext.value.createMediaStreamSource(stream.value)
  source.connect(analyser.value)

  analyser.value.fftSize = 256
  dataArray.value = new Uint8Array(analyser.value.frequencyBinCount)
}

const handleRecordingStop = async () => {
  const blob = new Blob(audioChunks.value, { type: 'audio/wav' })

  if (recordedURL.value?.startsWith('blob:')) {
    URL.revokeObjectURL(recordedURL.value)
  }
  recordedURL.value = URL.createObjectURL(blob)

  try {
    const path = await useAudioService().convertBlobToFileAndSubmit(blob)

    // Immediately update all values - this is the new recording, override everything
    modelValue.value = path
    lastUploadedPath = path

    // Update Vue nodeData widgets
    if (props.nodeData?.widgets) {
      const audioWidgets = props.nodeData.widgets.filter(
        (w: any) =>
          w.name === 'audio' ||
          w.name === 'audioUI' ||
          w.type === 'AUDIO_RECORD' ||
          w.type === 'AUDIOUPLOAD'
      )

      audioWidgets.forEach((widget: any) => {
        if (widget.options?.values && !widget.options.values.includes(path)) {
          widget.options.values.push(path)
        }
        widget.value = path
      })
    }

    // Update the model value to trigger reactivity and parent updates
    modelValue.value = path

    // Update LiteGraph node widgets directly
    if (props.node && (props.node as any).widgets) {
      const litegraphWidgets = (props.node as any).widgets
      litegraphWidgets.forEach((widget: any) => {
        if (widget.name === 'audio' || widget.name === 'audioUI') {
          widget.value = path
          if (widget.options?.values && !widget.options.values.includes(path)) {
            widget.options.values.push(path)
          }
        }
      })
    } else if (app && app.graph && app.graph.nodes) {
      // Try to find the LiteGraph node in the global graph
      const recordAudioNode = app.graph.nodes.find(
        (node: any) => node.constructor?.comfyClass === 'RecordAudio'
      )

      if (recordAudioNode && recordAudioNode.widgets) {
        recordAudioNode.widgets.forEach((widget: any) => {
          if (widget.name === 'audio' || widget.name === 'audioUI') {
            widget.value = path
            if (
              widget.options?.values &&
              !widget.options.values.includes(path)
            ) {
              widget.options.values.push(path)
            }
          }
        })
      }
    }
  } catch (e) {
    useToastStore().addAlert('Failed to upload recorded audio')
  }

  cleanup()
}

async function startRecording() {
  if (props.readonly) return

  try {
    // Clean up previous recording
    if (recordedURL.value?.startsWith('blob:')) {
      URL.revokeObjectURL(recordedURL.value)
    }

    audioChunks.value = []
    recordedURL.value = null
    // Don't clear modelValue here - it will be updated when recording stops
    timer.value = 0

    await setupAudioContext()
    await setupRecordingAudio()

    mediaRecorder.value = new ExtendableMediaRecorder(stream.value!, {
      mimeType: 'audio/wav'
    }) as unknown as MediaRecorder

    mediaRecorder.value.ondataavailable = (e) => {
      audioChunks.value.push(e.data)
    }

    mediaRecorder.value.onstop = handleRecordingStop

    // Start recording with minimum chunk interval to ensure we get data
    mediaRecorder.value.start(100)
    isRecording.value = true

    timerInterval.value = window.setInterval(() => {
      timer.value += 1
    }, 1000)

    initWaveform()
    updateWaveform()
  } catch (err) {
    useToastStore().addAlert(
      t('g.micPermissionDenied') || 'Microphone permission denied'
    )
  }
}

function stopRecording() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  } else {
    cleanup()
  }
}

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

  mediaElementSource.value = null
}

const setupPlaybackAudio = async () => {
  if (audioContext.value && audioContext.value.state !== 'closed') {
    await audioContext.value.close()
  }

  mediaElementSource.value = null
  audioElementKey.value += 1
  await nextTick()

  if (!audioRef.value) return false

  audioContext.value = new (window.AudioContext ||
    (window as any).webkitAudioContext)()
  analyser.value = audioContext.value.createAnalyser()

  mediaElementSource.value = audioContext.value.createMediaElementSource(
    audioRef.value
  )

  mediaElementSource.value.connect(analyser.value)
  analyser.value.connect(audioContext.value.destination)

  analyser.value.fftSize = 256
  dataArray.value = new Uint8Array(analyser.value.frequencyBinCount)

  return true
}

async function playRecording() {
  if (!recordedURL.value) return

  timer.value = 0
  isPlaying.value = true

  const audioSetup = await setupPlaybackAudio()
  if (!audioSetup) return

  timerInterval.value = window.setInterval(() => {
    timer.value = Math.floor(audioRef.value?.currentTime || 0)
  }, 100)

  void audioRef.value?.play()
  updateWaveform()

  if (!analyser.value || !dataArray.value) {
    initWaveform()
  }
}

function stopPlayback() {
  if (audioRef.value) {
    audioRef.value.pause()
    audioRef.value.currentTime = 0
  }
  void onPlaybackEnded()
}

function onAudioMetadataLoaded() {
  if (!isPlaying.value && !isRecording.value && audioRef.value?.duration) {
    timer.value = Math.floor(audioRef.value.duration)
  }
}

function onPlaybackEnded() {
  isPlaying.value = false

  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }

  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }

  if (audioRef.value?.duration) {
    timer.value = Math.floor(audioRef.value.duration)
  } else {
    timer.value = 0
  }
}

onMounted(() => {
  initWaveform()
})

onUnmounted(() => {
  stopRecording()
  stopPlayback()
  if (recordedURL.value) {
    URL.revokeObjectURL(recordedURL.value)
  }

  if (audioContext.value && audioContext.value.state !== 'closed') {
    void audioContext.value.close()
  }
  mediaElementSource.value = null
})

// Serialization function for workflow execution
async function serializeValue() {
  console.info('[RECORD_AUDIO_SERIALIZE] serializeValue called', {
    isRecording: isRecording.value,
    hasMediaRecorder: !!mediaRecorder.value,
    modelValue: modelValue.value,
    lastUploadedPath
  })

  // If still recording, stop and wait for completion
  if (isRecording.value && mediaRecorder.value) {
    console.info('[RECORD_AUDIO_SERIALIZE] Still recording, stopping...')
    mediaRecorder.value.stop()

    // Wait for recording to complete and upload
    await new Promise((resolve) => {
      const checkRecording = () => {
        if (!isRecording.value && modelValue.value) {
          console.info(
            '[RECORD_AUDIO_SERIALIZE] Recording stopped and uploaded:',
            modelValue.value
          )
          resolve(undefined)
        } else {
          setTimeout(checkRecording, 100)
        }
      }
      checkRecording()
    })
  }

  // Return the current model value - it should always be up to date now
  const result = modelValue.value || lastUploadedPath || ''
  console.info('[RECORD_AUDIO_SERIALIZE] Returning value:', result)
  return result
}

// Expose serializeValue for workflow execution
defineExpose({ serializeValue })
</script>
