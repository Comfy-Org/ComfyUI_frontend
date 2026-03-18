import { useMediaControls } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { api } from '@/scripts/api'
import { formatTime } from '@/utils/formatUtil'

interface WaveformBar {
  height: number
}

interface UseWaveAudioPlayerOptions {
  src: Ref<string>
  barCount?: number
}

export function useWaveAudioPlayer(options: UseWaveAudioPlayerOptions) {
  const { src, barCount = 40 } = options

  const audioRef = ref<HTMLAudioElement>()
  const waveformRef = ref<HTMLElement>()
  const blobUrl = ref<string>()
  const loading = ref(false)
  const bars = ref<WaveformBar[]>(generatePlaceholderBars())

  const { playing, currentTime, duration, volume, muted } =
    useMediaControls(audioRef)

  const playedBarIndex = computed(() => {
    if (duration.value === 0) return -1
    return Math.floor((currentTime.value / duration.value) * barCount) - 1
  })

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  const audioSrc = computed(() => blobUrl.value ?? src.value)

  function generatePlaceholderBars(): WaveformBar[] {
    return Array.from({ length: barCount }, () => ({
      height: Math.random() * 60 + 10
    }))
  }

  function generateBarsFromBuffer(buffer: AudioBuffer) {
    const channelData = buffer.getChannelData(0)
    if (channelData.length === 0) {
      bars.value = generatePlaceholderBars()
      return
    }

    const averages: number[] = []
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor((i * channelData.length) / barCount)
      const end = Math.max(
        start + 1,
        Math.floor(((i + 1) * channelData.length) / barCount)
      )
      let sum = 0
      for (let j = start; j < end && j < channelData.length; j++) {
        sum += Math.abs(channelData[j])
      }
      averages.push(sum / (end - start))
    }

    const peak = Math.max(...averages) || 1
    bars.value = averages.map((avg) => ({
      height: Math.max(8, (avg / peak) * 100)
    }))
  }

  async function decodeAudioSource(url: string) {
    loading.value = true
    let ctx: AudioContext | undefined
    try {
      const apiBase = api.apiURL('/')
      const route = url.includes(apiBase)
        ? url.slice(url.indexOf(apiBase) + api.apiURL('').length)
        : url
      const response = await api.fetchApi(route)
      if (!response.ok) {
        throw new Error(`Failed to fetch audio (${response.status})`)
      }
      const arrayBuffer = await response.arrayBuffer()

      const blob = new Blob([arrayBuffer.slice(0)], {
        type: response.headers.get('content-type') ?? 'audio/wav'
      })
      if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
      blobUrl.value = URL.createObjectURL(blob)

      ctx = new AudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      generateBarsFromBuffer(audioBuffer)
    } catch {
      bars.value = generatePlaceholderBars()
    } finally {
      await ctx?.close()
      loading.value = false
    }
  }

  const progressRatio = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  function togglePlayPause() {
    playing.value = !playing.value
  }

  function seekToStart() {
    currentTime.value = 0
  }

  function seekToEnd() {
    currentTime.value = duration.value
    playing.value = false
  }

  function seekToRatio(ratio: number) {
    const clamped = Math.max(0, Math.min(1, ratio))
    currentTime.value = clamped * duration.value
  }

  function toggleMute() {
    muted.value = !muted.value
  }

  const volumeIcon = computed(() => {
    if (muted.value || volume.value === 0) return 'icon-[lucide--volume-x]'
    if (volume.value < 0.5) return 'icon-[lucide--volume-1]'
    return 'icon-[lucide--volume-2]'
  })

  function handleWaveformClick(event: MouseEvent) {
    if (!waveformRef.value || duration.value === 0) return
    const rect = waveformRef.value.getBoundingClientRect()
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    )
    currentTime.value = ratio * duration.value

    if (!playing.value) {
      playing.value = true
    }
  }

  watch(
    src,
    (url) => {
      if (url) {
        playing.value = false
        currentTime.value = 0
        void decodeAudioSource(url)
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    audioRef.value?.pause()
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
  })

  return {
    audioRef,
    waveformRef,
    audioSrc,
    bars,
    loading,
    isPlaying: playing,
    playedBarIndex,
    progressRatio,
    formattedCurrentTime,
    formattedDuration,
    togglePlayPause,
    seekToStart,
    seekToEnd,
    volume,
    volumeIcon,
    toggleMute,
    seekToRatio,
    handleWaveformClick
  }
}
