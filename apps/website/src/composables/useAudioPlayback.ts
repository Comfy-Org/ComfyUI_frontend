import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, watch, toValue } from 'vue'

/**
 * One audio file, played in place. The element is the browser's; only the
 * controls around it are ours, so the row can wear the same buttons and rules
 * as everything beside it.
 */
export function useAudioPlayback(source: MaybeRefOrGetter<string | undefined>) {
  const audio = ref<HTMLAudioElement>()
  const playing = ref(false)
  const elapsed = ref(0)
  const duration = ref(0)

  // A different file is a different recording, not this one further along.
  watch(
    () => toValue(source),
    () => {
      playing.value = false
      elapsed.value = 0
      duration.value = 0
    }
  )

  const progress = computed(() =>
    duration.value > 0 ? (elapsed.value / duration.value) * 100 : 0
  )

  function toggle() {
    const element = audio.value
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }

  /** Where in the recording a click on the line lands. */
  function seek(event: MouseEvent) {
    const element = audio.value
    const line = event.currentTarget
    if (!element || !duration.value || !(line instanceof HTMLElement)) return
    const { left, width } = line.getBoundingClientRect()
    element.currentTime =
      Math.min(Math.max((event.clientX - left) / width, 0), 1) * duration.value
  }

  return { audio, playing, elapsed, duration, progress, toggle, seek }
}

/** mm:ss, the way a player has always written it. */
export function clock(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.floor(seconds) : 0
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
