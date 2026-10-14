import type { ModelRef } from 'vue'
import { computed } from 'vue'

import type {
  AspectRatio,
  Resolution
} from '@/lib/workshop/cinematic-studio/catalog'
import {
  ASPECT_RATIOS,
  MAX_TAKES,
  RESOLUTIONS
} from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** Menu options and string-valued models for the aspect, resolution and takes menus. */
export function useFormatMenus(
  aspect: ModelRef<AspectRatio>,
  resolution: ModelRef<Resolution>,
  takes: ModelRef<number>,
  locale: () => Locale,
  /**
   * The frames the chosen model can make. `undefined` leaves every frame on
   * offer; an empty list is a model that can make none, which is not the same
   * thing and must not fall back to offering all of them.
   */
  aspects: () => readonly AspectRatio[] | undefined = () => undefined
) {
  const aspectOptions = computed(() => {
    const { t } = translationsFor(locale())
    const supported = aspects()
    return ASPECT_RATIOS.filter(
      (ratio) => !supported || supported.includes(ratio.id)
    ).map((ratio) => ({
      id: ratio.id,
      label: ratio.id,
      meta: t(ratio.label)
    }))
  })
  const resolutionOptions = RESOLUTIONS.map((option) => ({
    id: option.id,
    label: option.id
  }))
  const takeOptions = Array.from({ length: MAX_TAKES }, (_, index) => ({
    id: String(index + 1),
    label: `×${index + 1}`
  }))

  const aspectValue = computed({
    get: () => aspect.value,
    set: (id: string) => {
      const match = ASPECT_RATIOS.find((ratio) => ratio.id === id)
      if (match) aspect.value = match.id
    }
  })
  const resolutionValue = computed({
    get: () => resolution.value,
    set: (id: string) => {
      const match = RESOLUTIONS.find((option) => option.id === id)
      if (match) resolution.value = match.id
    }
  })
  const takesValue = computed({
    get: () => String(takes.value),
    set: (id: string) => {
      takes.value = Number(id)
    }
  })

  return {
    aspectOptions,
    resolutionOptions,
    takeOptions,
    aspectValue,
    resolutionValue,
    takesValue
  }
}
