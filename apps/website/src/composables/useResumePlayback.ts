import { watch } from 'vue'
import type { Ref } from 'vue'

interface Playback {
  readonly time: number
  readonly playing: boolean
}

/**
 * A signed URL is renewed under the reader, and assigning the new `src` rewinds
 * the element. Where the asset behind it has not changed, the position and
 * whether it was playing carry across the swap — including staying paused,
 * which the element's own `autoplay` would otherwise undo. Moving to another
 * asset still starts from the beginning.
 */
export function useResumePlayback(
  element: Readonly<Ref<HTMLMediaElement | null>>,
  assetId: () => string | undefined,
  url: () => string
) {
  let shown = assetId()
  let pending: Playback | undefined

  watch(
    url,
    () => {
      const media = element.value
      pending =
        media && assetId() === shown
          ? { time: media.currentTime, playing: !media.paused }
          : undefined
      shown = assetId()
    },
    { flush: 'pre' }
  )

  function restore() {
    const media = element.value
    const resume = pending
    pending = undefined
    if (!media || !resume) return
    media.currentTime = resume.time
    if (resume.playing) void media.play().catch(() => undefined)
    else media.pause()
  }

  return { restore }
}
