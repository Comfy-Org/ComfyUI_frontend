import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

const SEEK_STEP_SECONDS = 5

/**
 * One audio file, played in place. The element is the browser's; only the
 * controls around it are ours, so the row can wear the same buttons and rules
 * as everything beside it. Nothing is downloaded until the reader asks to
 * hear it, so a form full of example inputs costs nothing to open.
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

  // A live recording has no end yet, and some containers report none at all.
  // Until a real length arrives there is nothing to be a fraction of.
  const seekable = computed(
    () => Number.isFinite(duration.value) && duration.value > 0
  )
  const progress = computed(() =>
    seekable.value ? (elapsed.value / duration.value) * 100 : 0
  )

  function toggle() {
    const element = audio.value
    if (!element) return
    if (!element.paused) {
      element.pause()
      return
    }
    // The first play is also the first fetch, and either can be refused.
    element.play().catch(() => (playing.value = false))
  }

  function seekTo(seconds: number) {
    const element = audio.value
    if (!element || !seekable.value || Number.isNaN(seconds)) return
    element.currentTime = Math.min(Math.max(seconds, 0), duration.value)
  }

  /** Where in the recording a click on the line lands. */
  function seekToPoint(event: MouseEvent) {
    const line = event.currentTarget
    if (!seekable.value || !(line instanceof HTMLElement)) return
    const { left, width } = line.getBoundingClientRect()
    if (!width) return
    seekTo(((event.clientX - left) / width) * duration.value)
  }

  /** The same line under the arrow keys, for a reader who has no pointer. */
  function seekByKey(event: KeyboardEvent) {
    const target = {
      ArrowLeft: () => elapsed.value - SEEK_STEP_SECONDS,
      ArrowRight: () => elapsed.value + SEEK_STEP_SECONDS,
      Home: () => 0,
      End: () => duration.value
    }[event.key]
    if (!target) return
    event.preventDefault()
    seekTo(target())
  }

  // With nothing preloaded the length arrives late, and a stream may revise it.
  function readDuration() {
    duration.value = audio.value?.duration ?? 0
  }

  return {
    audio,
    playing,
    elapsed,
    duration,
    seekable,
    progress,
    toggle,
    seekTo,
    seekToPoint,
    seekByKey,
    readDuration
  }
}

/** mm:ss, the way a player has always written it. */
export function clock(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.floor(seconds) : 0
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
