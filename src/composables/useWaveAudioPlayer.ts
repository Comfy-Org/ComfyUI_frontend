import { tryOnScopeDispose, useMediaControls, whenever } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import type { Surface } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { createToastId } from '@/types/toastId'
import { formatTime } from '@/utils/formatUtil'

interface WaveformBar {
  height: number
}

interface UseWaveAudioPlayerOptions {
  src: Readonly<Ref<string | undefined>>
  logicalSrc?: Readonly<Ref<string | undefined>>
  surface?: Surface
  barCount?: number
  waveform?: boolean
}

export function useWaveAudioPlayer(options: UseWaveAudioPlayerOptions) {
  const {
    src,
    logicalSrc = src,
    surface = 'assets',
    barCount = 40,
    waveform = true
  } = options

  const audioRef = ref<HTMLAudioElement>()
  const waveformRef = ref<HTMLElement>()
  const loading = ref(false)
  let decodeRequestId = 0
  const bars = ref<WaveformBar[]>(generatePlaceholderBars())

  const toast = useToast()
  const playbackErrorToastId = createToastId()
  let playAttempt = 0

  const { playing, currentTime, duration, volume, muted } =
    useMediaControls(audioRef)

  function invalidatePlayback() {
    playAttempt++
    toast.dismiss(playbackErrorToastId)
  }

  tryOnScopeDispose(invalidatePlayback)
  watch(logicalSrc, invalidatePlayback)

  const playedBarIndex = computed(() => {
    if (duration.value === 0) return -1
    return Math.floor((currentTime.value / duration.value) * barCount) - 1
  })

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

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
    const requestId = ++decodeRequestId
    loading.value = true
    let ctx: AudioContext | undefined
    try {
      const apiBase = api.apiURL('/')
      const route = url.includes(apiBase)
        ? url.slice(url.indexOf(apiBase) + api.apiURL('').length)
        : url
      const response = await api.fetchApi(route)
      if (requestId !== decodeRequestId) return
      if (!response.ok) {
        console.error(`Failed to fetch audio (${response.status})`)
        if (requestId === decodeRequestId) {
          bars.value = generatePlaceholderBars()
        }
        return
      }
      const arrayBuffer = await response.arrayBuffer()

      if (requestId !== decodeRequestId) return

      ctx = new AudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      if (requestId !== decodeRequestId) return
      generateBarsFromBuffer(audioBuffer)
    } catch {
      if (requestId === decodeRequestId) {
        bars.value = generatePlaceholderBars()
      }
    } finally {
      await ctx?.close()
      if (requestId === decodeRequestId) {
        loading.value = false
      }
    }
  }

  const progressRatio = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  async function startPlayback() {
    const audio = audioRef.value
    if (!audio) return

    const attempt = ++playAttempt
    try {
      if (audio.error) audio.load()
      await audio.play()
      if (attempt === playAttempt) toast.dismiss(playbackErrorToastId)
    } catch (error) {
      if (attempt !== playAttempt) return
      audio.pause()
      playing.value = false
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.dismiss(playbackErrorToastId)
        return
      }
      reportError(error, {
        errorType: 'error_playing_audio',
        surface,
        level: 'warning'
      })
      toast.error(t('g.error'), {
        id: playbackErrorToastId,
        description: t('g.audioPlaybackFailed')
      })
    }
  }

  function togglePlayPause() {
    const audio = audioRef.value
    if (!audio) return

    if (audio.paused) {
      void startPlayback()
      return
    }
    invalidatePlayback()
    audio.pause()
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

    if (audioRef.value?.paused) void startPlayback()
  }

  whenever(
    src,
    (url) => {
      playing.value = false
      currentTime.value = 0
      if (waveform) void decodeAudioSource(url)
    },
    { immediate: true }
  )

  return {
    audioRef,
    waveformRef,
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
    muted,
    volumeIcon,
    toggleMute,
    seekToRatio,
    handleWaveformClick
  }
}
