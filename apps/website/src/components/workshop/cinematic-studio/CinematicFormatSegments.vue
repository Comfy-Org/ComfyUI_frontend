<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import type {
  AspectRatio,
  Resolution
} from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import { framedStyle } from './aspect-style'
import { SEGMENT_TRIGGER_CLASS } from './cinematic-menu-trigger'
import CinematicMenu from './CinematicMenu.vue'
import { useFormatMenus } from './useFormatMenus'

const { locale = 'en', aspects } = defineProps<{
  locale?: Locale
  /** The frames the chosen model can make; every frame when absent. */
  aspects?: readonly AspectRatio[]
}>()
const { t } = translationsFor(locale)

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })

const {
  aspectOptions,
  resolutionOptions,
  takeOptions,
  aspectValue,
  resolutionValue,
  takesValue
} = useFormatMenus(
  aspect,
  resolution,
  takes,
  () => locale,
  () => aspects
)
</script>

<template>
  <div
    role="group"
    :aria-label="t('cinematic.composer.format')"
    class="flex h-9 shrink-0 items-center overflow-hidden rounded-xl text-[13px] whitespace-nowrap ring-1 ring-transparency-white-t8 ring-inset"
  >
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="t('cinematic.output.aspect')"
      :trigger-class="SEGMENT_TRIGGER_CLASS"
      tooltip
    >
      <span class="grid size-4 place-items-center" aria-hidden="true">
        <span
          class="block max-h-full rounded-xs border-[1.5px] border-current"
          :style="framedStyle(aspect, '1rem')"
        />
      </span>
      {{ aspect }}
    </CinematicMenu>
    <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
    <CinematicMenu
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="t('cinematic.output.resolution')"
      :trigger-class="SEGMENT_TRIGGER_CLASS"
      tooltip
    >
      {{ resolution }}
    </CinematicMenu>
    <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
    <CinematicMenu
      v-model="takesValue"
      :options="takeOptions"
      :heading="t('cinematic.output.takes')"
      :trigger-class="SEGMENT_TRIGGER_CLASS"
      tooltip
    >
      ×{{ takes }}
    </CinematicMenu>
  </div>
</template>
