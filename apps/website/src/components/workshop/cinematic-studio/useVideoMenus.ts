import type { ModelRef } from 'vue'
import { computed } from 'vue'

import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import { ASPECT_RATIOS } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/site'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicVideoCapabilities } from '../../../lib/workshop/cinematic-studio/video'
import { resolutionLabel } from '../../../lib/workshop/cinematic-studio/video'

/** Menu options and string-valued models for a video shot's length, resolution and frame. */
export function useVideoMenus(
  aspect: ModelRef<AspectRatio>,
  duration: ModelRef<number | undefined>,
  resolution: ModelRef<string | undefined>,
  video: () => CinematicVideoCapabilities,
  locale: () => Locale
) {
  const aspectOptions = computed(() =>
    ASPECT_RATIOS.filter((ratio) => video().aspects.includes(ratio.id)).map(
      (ratio) => ({
        id: ratio.id,
        label: ratio.id,
        meta: tc(ratio.label, {}, { locale: locale() })
      })
    )
  )
  const durationOptions = computed(() =>
    video().durations.map((seconds) => ({
      id: String(seconds),
      label: `${seconds}s`
    }))
  )
  const resolutionOptions = computed(() =>
    video().resolutions.map((value) => ({
      id: value,
      label: resolutionLabel(value)
    }))
  )

  const aspectValue = computed({
    get: () => aspect.value,
    set: (id: string) => {
      const match = ASPECT_RATIOS.find((ratio) => ratio.id === id)
      if (match) aspect.value = match.id
    }
  })
  const durationValue = computed({
    get: () => String(duration.value ?? ''),
    set: (id: string) => {
      duration.value = Number(id)
    }
  })
  const resolutionValue = computed({
    get: () => resolution.value ?? '',
    set: (id: string) => {
      resolution.value = id
    }
  })

  return {
    aspectOptions,
    durationOptions,
    resolutionOptions,
    aspectValue,
    durationValue,
    resolutionValue
  }
}
